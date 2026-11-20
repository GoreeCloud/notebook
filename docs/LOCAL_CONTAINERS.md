# Local Notebook API container — development preview

This is an **opt-in loopback-only development runner**, not a production
GoreeCloud Containers deployment, a public API, GoreeCloud Mesh device sync,
GoreeShield policy enforcement, Wardveil certification, or GoreeCloud
Identity integration. Do not configure public ingress or a reverse proxy
until real authentication/authorization, consent and security gates pass.

## Build and rootless Podman smoke

The Containerfile packages the existing FastAPI service only. Its base
is the Docker Official Image for Python 3.12.16 slim Bookworm, pinned to
a verified **Linux amd64 image manifest digest**; dependencies are the
repository's existing pinned direct Python requirements and original
first-party source. It does not package the separate React, Android
or Qt Quick applications.

Build locally from the repository root (the build may fetch reviewed,
version-pinned third-party packages from the internet):

    podman build -f Containerfile -t localhost/goreecloud-notebook:local-preview .

Then run this explicitly authorized disposable smoke:

    bash scripts/smoke_container_preview.sh

The smoke script requires the just-built image, creates a unique synthetic
SQLite named volume and temporary rootless container, binds an OS-chosen
**127.0.0.1-only** TCP port and generates a random per-test bearer token
in the process environment. It checks that unauthenticated note API requests
are rejected, and authorized creation, pagination and full-note requests
work. It also verifies a non-root process and read-only application root.

The script has an EXIT trap to remove only its temporary named container
and test volume, not pre-existing Notebook files, devices, Podman images,
unrelated containers or volumes. No real Notebook profile or private
credentials are mounted into the test container.

## Optional persistent local Compose preview

The compose.yaml is source-controlled as an optional development
configuration for Docker Compose. The authorized Linux laptop currently
has **rootless Podman but no compatible Compose provider**, so a live
Compose-startup test is NOT claimed.

On a host with a reviewed, installed Compose provider, generate a local
development token in your current private shell:

    export GC_NOTEBOOK_TOKEN="$(python3 -c 'import secrets;print(secrets.token_urlsafe(40))')"

Run the preview from repository root:

    docker compose up --build

The Compose file requires that variable, publishes only
127.0.0.1:8000, and mounts its own named notebook-dev-data volume
under /data. Protect the volume and your host. The token is in the
container environment and may be visible to a privileged local
operator or container inspection; never commit it, print it into logs,
put it in a public cloud configuration, or reuse it on other systems.
SQLite notes in this named volume remain **plaintext at rest**.
Back up a retained development volume separately before upgrades.

The container runs as non-root UID 10001 with a read-only application
filesystem, restricted tmpfs, all capabilities dropped, no-new-privileges,
and bounded PIDs/memory. Its internal network bind is 0.0.0.0:8000
solely for container port forwarding; the HOST port remains loopback-only.
Container egress is not blocked by these settings. An unauthenticated
health endpoint does not grant access to the bearer-protected notes API.

## Still open

This is not a production runbook or service readiness certification.
A signed image, verified SBOM/CVE review, immutable transitive package
hashes, multiarch base qualification, disaster recovery, automated
upgrades, operations monitoring, a tested Compose provider, TLS ingress,
Identity authorization, GoreeShield, Wardveil and Mesh integration are
**not implemented or accepted**. The host and volume security remain
operator responsibilities. Run neither the API nor its bearer token
behind public ingress until those requirements are met.
