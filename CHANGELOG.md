# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-02-10

### Added
- `parseDotenv(content, { expand: true })` library option to opt into dotenv expansion.
- CLI `--expand` flag (plus compatibility alias `--exapnd`).
- Conflict validation for `--env` + `--file`.
- Exported dotenv parsing types from the package entrypoint.
- Build step now marks `dist/cli.js` executable.

### Changed
- Dotenv expansion is now disabled by default to avoid potential quadratic behavior on large files.
- Syntax validation for dotenv lines now mirrors dotenv parsing behavior to avoid contradictory parse/classification output.

### Fixed
- Removed misleading private-key host mapping (`crt.sh`) via upstream mapping refresh.
- Added AWS mappings so `AWS_ACCESS_KEY_ID`/`AKIA...` detections map to AWS hosts instead of being dropped.

## [0.1.0] - 2026-02-09

### Added
- Initial release.
- Environment variable classifier and Gondolin integration helper.
- CLI `inspect` mode for process env and dotenv files.
