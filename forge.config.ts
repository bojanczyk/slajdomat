import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: 'src/icons/slajdomat.icns',
    executableName: 'slajdomat',
    osxSign: {
      // ad-hoc signing (no paid Apple Developer account): this signs the
      // whole bundle so codesign --verify passes, which is what unlocks
      // macOS's "unidentified developer, open anyway" recovery path
      // instead of the unrecoverable "app is damaged" dead end. See
      // docs/developer-notes.md's "Code signing on mac" section.
      identity: '-',
      identityValidation: false,
      // hardenedRuntime defaults to true in @electron/osx-sign, since it's
      // a prerequisite for notarization. We're not notarizing, and hardened
      // runtime's library validation requires every loaded framework to
      // share the main executable's Team ID -- which ad-hoc signing can't
      // provide, since there is no real identity. With it left on, the
      // packaged app fails to launch at all: dyld refuses to load
      // Electron Framework with "different Team IDs". Note this can only
      // be disabled via optionsForFile -- a flat top-level
      // `hardenedRuntime: false` here is silently ignored, since
      // @electron/osx-sign only reads that key from the per-file options
      // returned by optionsForFile (or its own defaults, which hardcode
      // true), never from the top-level sign options object.
      optionsForFile: () => ({ hardenedRuntime: false }),
    },
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    // new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/electron/electron.html',
            js: './src/electron/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/electron/preload.ts',
            },
          },
        ],
      },
    }),
  ],
};

export default config;
