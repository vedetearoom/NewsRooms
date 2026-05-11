import unittest
import uuid
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import delete

from app.database import async_session, engine, init_db
from app.models import (
    IntelligenceCard,
    InspirationAsset,
    ManualVideoInboxItem,
    MonitorTarget,
    QuotaUsageCounter,
    Role,
    Source,
    Task,
    User,
    user_roles,
)

from app.services import quota_service
from app.api.seed import seed_demo_data


class QuotaLimitNormalizationTests(unittest.TestCase):
    def test_default_user_limits_match_light_trial_plan(self):
        limits = quota_service.default_quota_limits()

        self.assertEqual(limits[quota_service.TEXT_SOURCES], 3)
        self.assertEqual(limits[quota_service.VIDEO_MONITORS], 1)
        self.assertEqual(limits[quota_service.TASKS], 3)
        self.assertEqual(limits[quota_service.INSPIRATIONS], 10)
        self.assertEqual(limits[quota_service.ARTICLE_CARDS], 30)
        self.assertEqual(limits[quota_service.VIDEO_CARDS], 5)
        self.assertEqual(limits[quota_service.DAILY_AI_RUNS], 10)

    def test_blank_quota_value_means_unlimited(self):
        limits = quota_service.normalize_quota_limits({quota_service.TEXT_SOURCES: ""})

        self.assertIsNone(limits[quota_service.TEXT_SOURCES])

    def test_invalid_quota_value_falls_back_to_default(self):
        limits = quota_service.normalize_quota_limits({quota_service.TEXT_SOURCES: "oops"})

        self.assertEqual(limits[quota_service.TEXT_SOURCES], 3)

    def test_zero_quota_value_is_a_real_zero_limit(self):
        limits = quota_service.normalize_quota_limits({quota_service.TEXT_SOURCES: 0})

        self.assertEqual(limits[quota_service.TEXT_SOURCES], 0)


class QuotaRoleMergeTests(unittest.TestCase):
    def test_merges_multiple_roles_by_most_generous_limit(self):
        limits = quota_service._merge_role_limits(
            [
                SimpleNamespace(code="user", quota_limits={quota_service.TEXT_SOURCES: 3}),
                SimpleNamespace(code="creator", quota_limits={quota_service.TEXT_SOURCES: 8}),
            ]
        )

        self.assertEqual(limits[quota_service.TEXT_SOURCES], 8)

    def test_unlimited_role_wins_over_numeric_limit(self):
        limits = quota_service._merge_role_limits(
            [
                SimpleNamespace(code="user", quota_limits={quota_service.TEXT_SOURCES: 3}),
                SimpleNamespace(code="pro", quota_limits={quota_service.TEXT_SOURCES: None}),
            ]
        )

        self.assertIsNone(limits[quota_service.TEXT_SOURCES])

    def test_super_admin_role_is_unlimited(self):
        limits = quota_service._merge_role_limits(
            [SimpleNamespace(code="super_admin", quota_limits={quota_service.TEXT_SOURCES: 1})]
        )

        self.assertTrue(all(value is None for value in limits.values()))


class QuotaErrorDetailTests(unittest.TestCase):
    def test_resource_quota_error_is_structured_409(self):
        with self.assertRaises(HTTPException) as ctx:
            quota_service._raise_resource_quota(quota_service.TEXT_SOURCES, 3, 3)

        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.detail["code"], "QUOTA_LIMIT_EXCEEDED")
        self.assertEqual(ctx.exception.detail["quota_key"], quota_service.TEXT_SOURCES)
        self.assertIn("联系管理员升级套餐", ctx.exception.detail["message"])

    def test_daily_quota_error_is_structured_429(self):
        with self.assertRaises(HTTPException) as ctx:
            quota_service._raise_daily_quota(quota_service.DAILY_VIDEO_ANALYSES, 5, 5)

        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(ctx.exception.detail["code"], "QUOTA_DAILY_EXCEEDED")
        self.assertEqual(ctx.exception.detail["quota_key"], quota_service.DAILY_VIDEO_ANALYSES)


class QuotaEnforcementIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await engine.dispose()
        await init_db()
        suffix = uuid.uuid4().hex[:8]
        self.suffix = suffix
        self.username = f"quota_user_{suffix}"
        self.role_code = f"quota_role_{suffix}"

        limits = quota_service.default_quota_limits()
        for key in quota_service.RESOURCE_QUOTA_KEYS:
            limits[key] = 1
        for key in quota_service.DAILY_QUOTA_KEYS:
            limits[key] = 1

        async with async_session() as db:
            user = User(
                username=self.username,
                email=f"{self.username}@example.com",
                display_name="Quota Test User",
                password_hash="test",
                is_active=True,
            )
            role = Role(
                name=f"Quota Role {suffix}",
                code=self.role_code,
                quota_limits=limits,
                is_system=False,
            )
            db.add_all([user, role])
            await db.flush()
            await db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
            await db.commit()
            self.user_id = user.id
            self.role_id = role.id

    async def asyncTearDown(self):
        async with async_session() as db:
            for model in (
                QuotaUsageCounter,
                ManualVideoInboxItem,
                MonitorTarget,
                Source,
                InspirationAsset,
                IntelligenceCard,
                Task,
            ):
                await db.execute(delete(model).where(model.owner_user_id == self.user_id))
            await db.execute(delete(user_roles).where(user_roles.c.user_id == self.user_id))
            await db.execute(delete(Role).where(Role.id == self.role_id))
            await db.execute(delete(User).where(User.id == self.user_id))
            await db.commit()
        await engine.dispose()

    def _resource_row(self, quota_key: str):
        marker = f"{self.suffix}-{quota_key}"
        if quota_key == quota_service.TEXT_SOURCES:
            return Source(owner_user_id=self.user_id, name=marker, url=f"https://example.com/{marker}", source_type="rss")
        if quota_key == quota_service.VIDEO_MONITORS:
            return MonitorTarget(
                owner_user_id=self.user_id,
                name=marker,
                platform="youtube",
                platform_id=marker,
                homepage_url=f"https://youtube.com/@{marker}",
                rss_url=f"https://example.com/{marker}.xml",
            )
        if quota_key == quota_service.TASKS:
            return Task(owner_user_id=self.user_id, task_type="summary", title=marker)
        if quota_key == quota_service.INSPIRATIONS:
            return InspirationAsset(owner_user_id=self.user_id, title=marker, platform="article")
        if quota_key == quota_service.ARTICLE_CARDS:
            return IntelligenceCard(
                owner_user_id=self.user_id,
                title=marker,
                summary="summary",
                content_type="article",
            )
        if quota_key == quota_service.VIDEO_CARDS:
            return IntelligenceCard(
                owner_user_id=self.user_id,
                title=marker,
                summary="summary",
                content_type="video",
            )
        if quota_key == quota_service.MANUAL_VIDEO_ITEMS:
            return ManualVideoInboxItem(
                owner_user_id=self.user_id,
                source_kind="url",
                original_url=f"https://video.example.com/{marker}",
                normalized_url=f"https://video.example.com/{marker}",
                platform="youtube",
                title=marker,
            )
        raise AssertionError(f"Unsupported quota key in test: {quota_key}")

    async def _delete_resource_row(self, db, quota_key: str) -> None:
        if quota_key == quota_service.TEXT_SOURCES:
            await db.execute(delete(Source).where(Source.owner_user_id == self.user_id))
        elif quota_key == quota_service.VIDEO_MONITORS:
            await db.execute(delete(MonitorTarget).where(MonitorTarget.owner_user_id == self.user_id))
        elif quota_key == quota_service.TASKS:
            await db.execute(delete(Task).where(Task.owner_user_id == self.user_id))
        elif quota_key == quota_service.INSPIRATIONS:
            await db.execute(delete(InspirationAsset).where(InspirationAsset.owner_user_id == self.user_id))
        elif quota_key == quota_service.ARTICLE_CARDS:
            await db.execute(
                delete(IntelligenceCard).where(
                    IntelligenceCard.owner_user_id == self.user_id,
                    IntelligenceCard.content_type != "video",
                )
            )
        elif quota_key == quota_service.VIDEO_CARDS:
            await db.execute(
                delete(IntelligenceCard).where(
                    IntelligenceCard.owner_user_id == self.user_id,
                    IntelligenceCard.content_type == "video",
                )
            )
        elif quota_key == quota_service.MANUAL_VIDEO_ITEMS:
            await db.execute(delete(ManualVideoInboxItem).where(ManualVideoInboxItem.owner_user_id == self.user_id))

    async def test_resource_number_limits_block_new_rows_and_delete_releases_slot(self):
        for quota_key in quota_service.RESOURCE_QUOTA_KEYS:
            with self.subTest(quota_key=quota_key):
                async with async_session() as db:
                    await quota_service.ensure_resource_quota(db, self.user_id, quota_key)
                    db.add(self._resource_row(quota_key))
                    await db.commit()

                    with self.assertRaises(HTTPException) as ctx:
                        await quota_service.ensure_resource_quota(db, self.user_id, quota_key)

                    self.assertEqual(ctx.exception.status_code, 409)
                    self.assertEqual(ctx.exception.detail["quota_key"], quota_key)
                    self.assertEqual(ctx.exception.detail["limit"], 1)
                    self.assertEqual(ctx.exception.detail["used"], 1)

                    await self._delete_resource_row(db, quota_key)
                    await db.commit()
                    await quota_service.ensure_resource_quota(db, self.user_id, quota_key)

    async def test_daily_limits_block_second_use(self):
        async with async_session() as db:
            for quota_key in quota_service.DAILY_QUOTA_KEYS:
                with self.subTest(quota_key=quota_key):
                    await quota_service.consume_daily_quota(db, self.user_id, quota_key)

                    with self.assertRaises(HTTPException) as ctx:
                        await quota_service.consume_daily_quota(db, self.user_id, quota_key)

                    self.assertEqual(ctx.exception.status_code, 429)
                    self.assertEqual(ctx.exception.detail["quota_key"], quota_key)
                    self.assertEqual(ctx.exception.detail["limit"], 1)
                    self.assertEqual(ctx.exception.detail["used"], 1)

    async def test_seed_demo_data_uses_resource_quota(self):
        async with async_session() as db:
            with self.assertRaises(HTTPException) as ctx:
                await seed_demo_data(
                    db=db,
                    current_user=SimpleNamespace(id=self.user_id),
                )

            self.assertEqual(ctx.exception.status_code, 409)
            self.assertEqual(ctx.exception.detail["quota_key"], quota_service.TEXT_SOURCES)

    async def test_quota_snapshot_matches_usage_and_state_flags_do_not_release_slots(self):
        async with async_session() as db:
            db.add_all(
                [
                    Source(
                        owner_user_id=self.user_id,
                        name=f"{self.suffix}-paused-source",
                        url=f"https://example.com/{self.suffix}/paused",
                        source_type="rss",
                        is_active=False,
                    ),
                    MonitorTarget(
                        owner_user_id=self.user_id,
                        name=f"{self.suffix}-paused-monitor",
                        platform="youtube",
                        platform_id=f"{self.suffix}-paused-monitor",
                        homepage_url=f"https://youtube.com/@{self.suffix}-paused",
                        rss_url=f"https://example.com/{self.suffix}/paused.xml",
                        is_active=False,
                    ),
                    Task(
                        owner_user_id=self.user_id,
                        task_type="summary",
                        title=f"{self.suffix}-archived-task",
                        status="completed",
                    ),
                    IntelligenceCard(
                        owner_user_id=self.user_id,
                        title=f"{self.suffix}-read-archived-article",
                        summary="summary",
                        content_type="article",
                        is_read=True,
                        is_archived=True,
                    ),
                    IntelligenceCard(
                        owner_user_id=self.user_id,
                        title=f"{self.suffix}-read-archived-video",
                        summary="summary",
                        content_type="video",
                        is_read=True,
                        is_archived=True,
                    ),
                ]
            )
            await quota_service.consume_daily_quota(db, self.user_id, quota_service.DAILY_SCRAPES)
            await db.commit()

            snapshot = await quota_service.build_quota_snapshot(db, self.user_id)

            self.assertEqual(snapshot["timezone"], "Asia/Shanghai")
            self.assertEqual(snapshot["resources"][quota_service.TEXT_SOURCES]["used"], 1)
            self.assertEqual(snapshot["resources"][quota_service.TEXT_SOURCES]["remaining"], 0)
            self.assertEqual(snapshot["resources"][quota_service.VIDEO_MONITORS]["used"], 1)
            self.assertEqual(snapshot["resources"][quota_service.TASKS]["used"], 1)
            self.assertEqual(snapshot["resources"][quota_service.ARTICLE_CARDS]["used"], 1)
            self.assertEqual(snapshot["resources"][quota_service.VIDEO_CARDS]["used"], 1)
            self.assertEqual(snapshot["daily"][quota_service.DAILY_SCRAPES]["used"], 1)
            self.assertEqual(snapshot["daily"][quota_service.DAILY_SCRAPES]["remaining"], 0)


if __name__ == "__main__":
    unittest.main()
