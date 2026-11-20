# Android CI dependency reliability and integrity

**Status:** Diagnostic reliability improvement; no claim of resolving all intermittent GitHub-hosted failures.

On November 20, 2026, the Android job in [main run 44818242652](https://github.com/GoreeCloud/notebook/actions/runs/44818242652) failed before APK packaging because fresh Gradle buildscript resolution could not find dozens of public dependencies (Kotlin stdlib, ASM, Maven plugins, etc.) and failed parsing plugin POM parent metadata. An independently rechecked Maven Central Kotlin 2.3.20 POM and Gradle plugin portal Kotlin Compose 2.3.10 POM returned HTTP 200 afterward. Previous failed main runs had instead reported `:app:packageDebug` / `IncrementalSplitterRunnable` without an informative underlying cause. These may be distinct issues. Successful PR builds did not fully explain the main-run failures; [issue #29](https://github.com/GoreeCloud/notebook/issues/29) remains open.

## Safe cache implementation

The Android job uses the official **MIT-licensed GitHub** `actions/cache` [v6.1.0](https://github.com/actions/cache/releases/tag/v6.1.0), pinned to verified Git commit `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (Node 24). This is deliberately preferred over third-party caching services or commercial bundled caching implementations.

Only the **public Gradle module artifact cache** (`~/.gradle/caches/modules-2`) and **Gradle wrapper distribution cache** (`~/.gradle/wrapper/dists`) are stored. No `~/.gradle/gradle.properties`, private credentials, source code, project build outputs, configuration cache, user data or signing keys are cached. Cache keys include runner OS and hashes of the repository's Gradle wrapper, build and settings files, with an explicit `v1` namespace. Pull requests are not granted permissions to write to the protected default branch's cache; GitHub's branch-scoped cache rules apply. Cache saving occurs only after successful jobs. No blanket retries or ignored failures are added.

The Gradle wrapper distribution also pins the [official Gradle 9.5.0 binary checksum](https://services.gradle.org/distributions/gradle-9.5.0-bin.zip.sha256) to `553c78f50dafcd54d65b9a444649057857469edf836431389695608536d6b746`. This verifies new downloads of that distribution. Existing caches, third-party binaries and module dependencies are **not** covered by this wrapper integrity check.

This implementation can reduce dependence on repeated repository downloads after a cache has been warmed. **Cold-cache runs still require remote Maven availability.** An external repository outage or a compromised dependency provider may still fail a build. Do not turn off required Android checks, use a privileged merge bypass, or claim that caches establish supply-chain security. Revisit Gradle dependency verification metadata or stronger provenance checks in a separately reviewed change.

**Validation:** CI must run all four required checks under the protected PR before merging. Continue collecting any failed main-run logs with `--stacktrace`; do not close issue #29 without evidence of sustained reliability.

## CI Java action immutability and Node 24 runtime

The Android job now uses official, MIT-licensed
[actions/setup-java v6.3.0](https://github.com/actions/setup-java/releases/tag/v6.3.0)
at pinned commit `d1374f8ac74474200d16ef8ecee22c7ae7a51880`.
The upstream action metadata declares `using: node24`. Java **21** and the
Temurin distribution remain unchanged; `problem-matcher: true` preserves
compiler annotations despite v6.3.0's opt-out default. The project also
tests that every `actions/*` action reference in the workflow is pinned to
a full immutable 40-character commit ID.

This is a CI supply-chain and runtime maintenance improvement. It does not
identify or prove a fix for the unrelated intermittent Android
`:app:packageDebug`/dependency failures tracked in issue #29.

The same Android CI job also pins MIT-licensed
[android-actions/setup-android v4.0.4](https://github.com/android-actions/setup-android/releases/tag/v4.0.4)
(`be39fa834029ff78f1a44aa3bb0819b8fc2bd8fd`) and
[actions/upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)
(`cf430e030ddbb5b0abf93d22962f4752f3646cd9`).
Both upstream action metadata files specify the Node 24 runner.
These exact pinned revisions still require end-to-end GitHub Actions validation
of tool installation, Gradle packaging and APK artifact upload.
