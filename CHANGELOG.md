## [2.1.0-beta.2](https://github.com/tappify-dev/extension-sdk/compare/v2.1.0-beta.1...v2.1.0-beta.2) (2026-10-20)

### Features

- **manifest:** configure OAuth token encoding ([4d9707f](https://github.com/tappify-dev/extension-sdk/commit/4d9707fe4f189db136320afe27408d788441e27b))

## [2.1.0-beta.1](https://github.com/tappify-dev/extension-sdk/compare/v2.0.0...v2.1.0-beta.1) (2026-10-15)

### ⚠ BREAKING CHANGES

- **ui:** frontend components now import from @tappify/extension-sdk/ui and styles from @tappify/extension-sdk/ui/styles.css; legacy Tap\* UI exports were removed.

### Features

- define review work capabilities ([a98f34b](https://github.com/tappify-dev/extension-sdk/commit/a98f34bd8784a4903753a7cd5144dadcfdc705ae))
- **preview:** model local extension surfaces ([fb0039d](https://github.com/tappify-dev/extension-sdk/commit/fb0039d22e9836feebaab90f89d89a410b2afe3f))
- **preview:** render extensions in a local host ([f01eab5](https://github.com/tappify-dev/extension-sdk/commit/f01eab57fdc24820761f86b571629125c448c2ef))
- send signed review work events ([9a3c6c4](https://github.com/tappify-dev/extension-sdk/commit/9a3c6c420211d43e35b80a8d29c31882c20dd102))
- type work server operations ([8c059ed](https://github.com/tappify-dev/extension-sdk/commit/8c059edfe011885fcbed3e1c06a759e3d45a3bda))
- **ui:** add host-aware One UI dialogs ([370ef3b](https://github.com/tappify-dev/extension-sdk/commit/370ef3b64ea23031aa87e09efbf3054a4a1040c9))
- **ui:** add One UI actions and surfaces ([5cf9ef2](https://github.com/tappify-dev/extension-sdk/commit/5cf9ef2b6296e0bbf68ac954e60d52defe415386))
- **ui:** add One UI data and feedback primitives ([5d67d56](https://github.com/tappify-dev/extension-sdk/commit/5d67d56a78e2c4224a65b0905dcf573fdfbb3ca1))
- **ui:** add One UI field primitives ([5b7bf13](https://github.com/tappify-dev/extension-sdk/commit/5b7bf131a9e5234d217bf52511f23b85cc866bd5))
- **ui:** add One UI schema forms ([05d6ace](https://github.com/tappify-dev/extension-sdk/commit/05d6aceadbdbe2947021a9907f4cc68d086ac824))
- **ui:** establish One UI package boundary ([c76fadf](https://github.com/tappify-dev/extension-sdk/commit/c76fadfc8dde0caacc58bc7fb409c822ad12dab2))
- **ui:** replace Tap components with One UI ([e95f463](https://github.com/tappify-dev/extension-sdk/commit/e95f4638dd079d124f3c11ec5ccfd3bb3118bd2a))
- **vite:** serve extension preview at root ([ceeed33](https://github.com/tappify-dev/extension-sdk/commit/ceeed3357439581130681e377ef7b6f672dc634a))

### Bug Fixes

- align SDK npm releases with CLI ([594a90f](https://github.com/tappify-dev/extension-sdk/commit/594a90f2dbe18104ad9e7260020add616ce4edfa))
- **ci:** align SDK checks with supported Node versions ([72d4bdd](https://github.com/tappify-dev/extension-sdk/commit/72d4bdd8dd4dd9c9157a1c731d0a30a16f94cb51))
- **ci:** release the triggering branch ([3940230](https://github.com/tappify-dev/extension-sdk/commit/39402304ef784828ef64918fbfa12bbf770510b0))
- repair clean-checkout release gates ([12b573f](https://github.com/tappify-dev/extension-sdk/commit/12b573f2c91042b7309957db6bbe5eaffabcd11b))
- support Windows release checks and preview caches ([7454c3f](https://github.com/tappify-dev/extension-sdk/commit/7454c3fec22c6264721d4009a0988ee0b7e524ef))
- **test:** allow codegen compile time on Windows ([52257c4](https://github.com/tappify-dev/extension-sdk/commit/52257c44f2d7f4d05bdfc7c2ccd1370d320613dd))
- **testing:** support Vitest 4 matcher types ([909dd9c](https://github.com/tappify-dev/extension-sdk/commit/909dd9caf413484f014270ee80871f8af2791f34))
- **ui:** align boolean form fields ([479508a](https://github.com/tappify-dev/extension-sdk/commit/479508ae2fe1e3b2d26486229f0318cca49bea28))
- **ui:** align primitives with One UI states ([5de8907](https://github.com/tappify-dev/extension-sdk/commit/5de8907398cd9975ed9b8b876413b27f7e97ccde))
- **ui:** scope dialog portals to One UI root ([71cfddb](https://github.com/tappify-dev/extension-sdk/commit/71cfddb0f35fbf589b38f62c908c3e347bb2a825))

## 1.0.0 (2026-03-08)

### Features

- initial app-builder SDK ([19814ec](https://github.com/tappify-dev/app-builder/commit/19814ec2f0de1b3311327335dc901ee08ed8c9ef))

### Bug Fixes

- add tsconfig.eslint.json so lint can type-check test files ([24e507e](https://github.com/tappify-dev/app-builder/commit/24e507efd4808883e4f85b40d1f5091fb1c7665a))
- exclude test dir from tsconfig to fix type-check ([fc565bc](https://github.com/tappify-dev/app-builder/commit/fc565bc2b784ce732d299fcfbbda5b7486044be3))
