# Android CI dependency reliability and integrity

**Status:** Diagnostic reliability improvement; no claim of resolving all intermittent GitHub-hosted failures.

On November 20, 2026, the Android job in [main run 44818242652](https://github.com/GoreeCloud/notebook/actions/runs/44818242652) failed before APK packaging because fresh Gradle buildscript resolution could not find dozens of public dependencies (Kotlin stdlib, ASM, Maven plugins, etc.) and failed parsing plugin POM parent metadata. An independently rechecked Maven Central Kotlin 2.3.20 POM and Gradle plugin portal Kotlin Compose 2.3.10 POM returned HTTP 200 afterward. Previous failed main runs had instead reported `:app:packageDebug` / `IncrementalSplitterRunnable` without an informative underlying cause. These may be distinct issues. Successful PR builds did not fully explain the main-run failures; [issue #29](https://github.com/GoreeCloud/notebook/issues/29) remains open.

## Safe cache implementation

The Android job uses the official **MIT-licensed GitHub** `actions/cache` [v6.1.0](https://github.com/actions/cache/releases/tag/v6.1.0), pinned to verified Git commit `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (Node 24). This is deliberately preferred over third-party caching services or commercial bundled caching implementations.

Only the **public Gradle module artifact cache** (`~/.gradle/caches/modules-2`) and **Gradle wrapper distribution cache** (`~/.gradle/wrapper/dists`) are stored. No `~/.gradle/gradle.properties`, private credentials, source code, project build outputs, configuration cache, user data or signing keys are cached. Cache keys include runner OS and hashes of the repository's Gradle wrapper, build and settings files, with an explicit `v1` namespace. Pull requests are not granted permissions to write to the protected default branch's cache; GitHub's branch-scoped cache rules apply. Cache saving occurs only after successful jobs. No blanket retries or ignored failures are added.

The Gradle wrapper distribution also pins the [official Gradle 9.5.0 binary checksum](https://services.gradle.org/distributions/gradle-9.5.0-bin.zip.sha256) to `553c78f50dafcd54d65b9a444649057857469edf836431389695608536d6b746`. This verifies new downloads of that distribution. Existing caches, third-party binaries and module dependencies are **not** covered by this wrapper integrity check.

This implementation can reduce dependence on repeated repository downloads after a cache has been warmed. **Cold-cache runs still require remote Maven availability.** An external repository outage or a compromised dependency provider may still fail a build. Do not turn off required Android checks, use a privileged merge bypass, or claim that caches establish supply-chain security. Revisit Gradle dependency verification metadata or stronger provenance checks in a separately reviewed change.

**Validation:** CI must run all four required checks under the protected PR before merging. Continue collecting any failed main-run logs with `--stacktrace`; do not close issue #29 without evidence of sustained reliability.
