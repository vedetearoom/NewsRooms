#!/usr/bin/env python3
"""Normalize stored Bilibili thumbnail URLs from http to https."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app.models  # noqa: F401 - register SQLAlchemy models
from app.database import SyncSession
from app.models import IntelligenceCard, ManualVideoInboxItem, MonitorTarget
from app.services.video.thumbnail_utils import normalize_thumbnail_url
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified


def _normalize_value(value: object) -> tuple[object, bool]:
    if not isinstance(value, str):
        return value, False
    normalized = normalize_thumbnail_url(value)
    return normalized, normalized != value


def normalize_cards(session) -> int:
    changed = 0
    cards = session.execute(select(IntelligenceCard)).scalars().all()
    for card in cards:
        dirty = False
        normalized_cover, cover_changed = _normalize_value(card.cover_image)
        if cover_changed:
            card.cover_image = normalized_cover
            dirty = True

        extra_data = dict(card.extra_data or {})
        normalized_extra, extra_changed = _normalize_value(extra_data.get("thumbnail_url"))
        if extra_changed:
            extra_data["thumbnail_url"] = normalized_extra
            card.extra_data = extra_data
            flag_modified(card, "extra_data")
            dirty = True

        if dirty:
            changed += 1
    return changed


def normalize_manual_items(session) -> int:
    changed = 0
    items = session.execute(select(ManualVideoInboxItem)).scalars().all()
    for item in items:
        normalized_thumbnail, thumbnail_changed = _normalize_value(item.thumbnail)
        if thumbnail_changed:
            item.thumbnail = normalized_thumbnail
            changed += 1
    return changed


def normalize_monitor_targets(session) -> int:
    changed = 0
    targets = session.execute(select(MonitorTarget)).scalars().all()
    for target in targets:
        dirty = False
        cached_videos = []
        for video in target.cached_videos or []:
            if not isinstance(video, dict):
                cached_videos.append(video)
                continue
            next_video = dict(video)
            normalized_thumbnail, thumbnail_changed = _normalize_value(next_video.get("thumbnail"))
            if thumbnail_changed:
                next_video["thumbnail"] = normalized_thumbnail
                dirty = True
            cached_videos.append(next_video)

        if dirty:
            target.cached_videos = cached_videos
            flag_modified(target, "cached_videos")
            changed += 1
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report counts without committing changes.")
    args = parser.parse_args()

    with SyncSession() as session:
        card_count = normalize_cards(session)
        manual_count = normalize_manual_items(session)
        monitor_count = normalize_monitor_targets(session)

        if args.dry_run:
            session.rollback()
        else:
            session.commit()

    mode = "dry-run" if args.dry_run else "committed"
    print(
        f"{mode}: cards={card_count}, manual_video_items={manual_count}, "
        f"monitor_targets={monitor_count}"
    )


if __name__ == "__main__":
    main()
