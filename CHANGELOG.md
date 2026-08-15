# Changelog

## 2.0.0

### Breaking changes

- Removed `file`, `setting`, `Response`, `TreasureResponse`, public `request(action, payload)`, raw file paths, Base64 file operations and the legacy path-returning save flow.
- Removed `readBinaryFile`, `writeBinaryFile`, `createFile`, `updateFile`, `createDir`, `mkdir`, `deleteDir`, `selectDirectory` and the legacy untyped `saveDialog`.
- Requires Treasure host 2.0.0 or newer; no legacy transport compatibility layer is provided.

### Added

- Stable typed modules: `files`, `directories`, `storage`, `database`, `settings`, `menus`, `notifications` and `logs`.
- Single `Result<T>` response model and structured error codes including `FILE_TOO_LARGE`.
- File and directory references scoped by host-granted user authorization; contents are `Uint8Array`. The typed `files.saveDialog()` returns a writable `FileReference`.
- Private relative-key storage, typed SQL statements and per-statement transaction results.
- ProductionBridge contract tests、API 参考和桌面 E2E 检查清单。

See [MIGRATION-2.0.md](docs/MIGRATION-2.0.md) for migration guidance.
