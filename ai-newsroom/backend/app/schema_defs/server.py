from pydantic import BaseModel


class RSSHubPlatformConfigOut(BaseModel):
    key: str
    label: str
    env_var: str
    hint: str
    value_masked: str = ""
    is_configured: bool = False


class RSSHubServerConfigOut(BaseModel):
    service_name: str
    docker_compose_dir: str
    compose_file_path: str
    compose_file_exists: bool
    env_file_path: str
    env_file_exists: bool
    docker_command: str = ""
    restart_required: bool = True
    platforms: list[RSSHubPlatformConfigOut] = []


class RSSHubServerConfigUpdateRequest(BaseModel):
    cookies: dict[str, str] = {}
    restart_after_save: bool = False


class RSSHubServerActionResult(BaseModel):
    ok: bool
    message: str
    restart_required: bool = False
    restarted: bool = False
    restart_message: str = ""
