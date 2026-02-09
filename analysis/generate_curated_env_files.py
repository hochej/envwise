#!/usr/bin/env python3
"""Generate simplified curated env fixture files.

Outputs:
- test/fixtures/valid-secrets.env
- test/fixtures/invalid-vars.env
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MAPPING_PATH = REPO_ROOT / "data" / "gondolin" / "secret-mapping.gondolin.json"
OUT_DIR = REPO_ROOT / "test" / "fixtures"


def sanitize_keyword_for_var(keyword: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", keyword).strip("_").upper()


def main() -> None:
    mapping = json.loads(MAPPING_PATH.read_text())

    valid_lines: list[str] = []

    valid_lines.append("# Curated valid secret env vars")
    valid_lines.append("# Rule: every entry should be treated as secret and ideally mapped to a host")
    valid_lines.append("")

    valid_lines.append("# Exact-name mapping coverage")
    for i, name in enumerate(sorted(mapping["exact_name_host_map"].keys()), start=1):
        valid_lines.append(f"{name}=exact_secret_value_{i:03d}")

    valid_lines.append("")
    valid_lines.append("# Keyword mapping coverage (one var per keyword)")
    for i, keyword in enumerate(sorted(mapping["keyword_host_map"].keys()), start=1):
        key = sanitize_keyword_for_var(keyword)
        valid_lines.append(f"{key}_API_KEY=keyword_secret_value_{i:03d}")

    valid_lines.append("")
    valid_lines.append("# Provider-specific secret-like entries")
    valid_lines.extend(
        [
            "GITHUB_TOKEN=secret_value_for_github",
            "OPENAI_API_KEY=secret_value_for_openai",
            "GITLAB_TOKEN=secret_value_for_gitlab",
            "NPM_TOKEN=secret_value_for_npm",
            "SLACK_TOKEN=secret_value_for_slack",
            "STRIPE_API_KEY=secret_value_for_stripe",
            "TWILIO_AUTH_TOKEN=secret_value_for_twilio",
        ]
    )

    valid_lines.append("")
    valid_lines.append("# Real-world secret-like names (mapped by exact env var name)")
    valid_lines.extend(
        [
            "BRAVE_API_KEY=secret_value_for_brave",
            "GEMINI_API_KEY=secret_value_for_gemini",
            "KIMI_API_KEY=secret_value_for_kimi",
            "OPENROUTER_API_KEY=secret_value_for_openrouter",
            "DEEPSEEK_API_KEY=secret_value_for_deepseek",
            "PERPLEXITY_API_KEY=secret_value_for_perplexity",
            "GROQ_API_KEY=secret_value_for_groq",
            "TOGETHER_X_API_KEY=secret_value_for_together_x",
        ]
    )

    invalid_lines: list[str] = []
    invalid_lines.append("# Curated invalid / non-secret env vars")
    invalid_lines.append("# Rule: these should not be classified as secret")
    invalid_lines.append("")
    invalid_lines.extend(
        [
            "PATH=/usr/local/bin:/usr/bin:/bin",
            "HOME=/home/dev",
            "TERM=xterm-256color",
            "SHELL=/bin/zsh",
            "USER=dev",
            "LOGNAME=dev",
            "LANG=en_US.UTF-8",
            "PWD=/workspace/project",
            "TMPDIR=/tmp",
            "EDITOR=vim",
            "COLORTERM=truecolor",
            "HOSTNAME=dev-machine",
            "TZ=UTC",
            "CI=true",
            "CI_JOB_ID=123456",
            "CI_PIPELINE_ID=987654",
            "NODE_ENV=production",
            "APP_ENV=prod",
            "APP_NAME=gondolin",
            "APP_PORT=8080",
            "APP_HOST=0.0.0.0",
            "APP_PROTOCOL=https",
            "HTTP_PORT=80",
            "HTTPS_PORT=443",
            "HEALTHCHECK_PATH=/healthz",
            "METRICS_PATH=/metrics",
            "DATABASE_HOST=db.internal",
            "DATABASE_PORT=5432",
            "DATABASE_NAME=app",
            "DATABASE_POOL_SIZE=20",
            "REDIS_HOST=redis.internal",
            "REDIS_PORT=6379",
            "REDIS_DB=0",
            "KAFKA_BROKERS=kafka1:9092,kafka2:9092",
            "RABBITMQ_HOST=rabbit.internal",
            "RABBITMQ_PORT=5672",
            "S3_BUCKET=app-assets",
            "AWS_REGION=us-east-1",
            "CLOUD_PROJECT_ID=my-project",
            "AZURE_TENANT_ID=863cf477-642b-48a7-8a3f-5193538361d7",
            "REQUEST_TIMEOUT_MS=30000",
            "RETRY_COUNT=3",
            "RETRY_BACKOFF_MS=250",
            "LOG_LEVEL=info",
            "LOG_FORMAT=json",
            "FEATURE_FLAG_NEW_UI=true",
            "FEATURE_FLAG_BETA_SEARCH=false",
            "CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com",
            "OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317",
            "OTEL_SERVICE_NAME=gondolin-api",
            "PROMETHEUS_SCRAPE_INTERVAL=15s",
            "BUILD_SHA=7d9f1f5",
            "BUILD_DATE=2026-02-09",
            "RELEASE_CHANNEL=stable",
            "MAX_WORKERS=8",
            "WORKER_CONCURRENCY=16",
            "QUEUE_NAME=jobs-default",
            "CACHE_TTL_SECONDS=600",
            "UPLOAD_MAX_MB=50",
            "ALLOWED_FILE_TYPES=jpg,png,pdf",
            "SERVICE_DISCOVERY_URL=http://consul:8500",
            "INTERNAL_API_BASE=http://internal-api:8081",
            "PUBLIC_API_BASE=https://api.example.com",
            "DOCS_URL=https://docs.example.com",
            "SUPPORT_EMAIL=support@example.com",
            "SMTP_HOST=smtp.example.com",
            "SMTP_PORT=587",
            "SMTP_STARTTLS=true",
            "LOCALE_DEFAULT=en",
            "TIMEZONE_DEFAULT=UTC",
            "COUNTRY_DEFAULT=US",
            "PAGINATION_DEFAULT_LIMIT=50",
            "PAGINATION_MAX_LIMIT=200",
            "SESSION_COOKIE_NAME=session_id",
            "SESSION_COOKIE_SECURE=true",
            "SESSION_COOKIE_SAMESITE=lax",
            "CSRF_COOKIE_NAME=csrf_token_name",
            "STATIC_URL=https://cdn.example.com/static",
            "MEDIA_URL=https://cdn.example.com/media",
            "WEBHOOK_RETRY_LIMIT=5",
            "WEBHOOK_TIMEOUT_MS=10000",
            "EXPORT_DIR=/var/lib/app/exports",
            "IMPORT_DIR=/var/lib/app/imports",
            "TEMP_DIR=/var/lib/app/tmp",
            "ARCHIVE_DIR=/var/lib/app/archive",
            "ENABLE_SIGNUP=false",
            "ENABLE_TELEMETRY=true",
            "ENABLE_AUDIT_LOG=true",
            "ENABLE_RATE_LIMIT=true",
            "RATE_LIMIT_RPS=100",
            "RATE_LIMIT_BURST=200",
            "KUBE_NAMESPACE=production",
            "KUBE_CLUSTER=gondolin-prod",
            "KUBE_CONTEXT=prod-us-east-1",
            "GIT_BRANCH=main",
            "GIT_COMMITTER=ci-bot",
            "DEPLOYMENT_STRATEGY=rolling",
            "MAINTENANCE_MODE=false",
            "UPTIME_SLA=99.9",
            "ANALYTICS_OPT_IN=true",
            "INIT_CWD=/Users/dev/work/envwise",
            "XDG_DATA_DIRS=/usr/local/share:/usr/share",
            "ZELLIJ_CONFIG_DIR=/Users/dev/.config/zellij",
            "GHOSTTY_BIN_DIR=/Applications/Ghostty.app/Contents/MacOS",
            "GHOSTTY_RESOURCES_DIR=/Applications/Ghostty.app/Contents/Resources",
            "NIX_SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt",
            "TERM_PROGRAM=ghostty",
            "TERM_PROGRAM_VERSION=1.2.3",
            "npm_command=run-script",
            "npm_execpath=/opt/homebrew/bin/pnpm",
            "npm_lifecycle_event=test",
            "npm_package_json=/workspace/envwise/package.json",
            "npm_config_cache=/Users/dev/.npm",
            "npm_config_user_agent=pnpm/10.15.1 node/v22.18.0 darwin arm64",
            "NIX_PROFILES=/nix/var/nix/profiles/default",
            "SSH_AUTH_SOCK=/private/tmp/com.apple.launchd.xxxxxx/Listeners",
            "STARSHIP_SHELL=zsh",
        ]
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "valid-secrets.env").write_text("\n".join(valid_lines) + "\n")
    (OUT_DIR / "invalid-vars.env").write_text("\n".join(invalid_lines) + "\n")

    print(f"wrote {OUT_DIR / 'valid-secrets.env'} ({len(valid_lines)} lines)")
    print(f"wrote {OUT_DIR / 'invalid-vars.env'} ({len(invalid_lines)} lines)")


if __name__ == "__main__":
    main()
