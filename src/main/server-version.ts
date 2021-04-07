export { upgradeManifest, oldVersion, version }
import { Manifest, ZoomEvent } from '../viewer/types'


import { version as versionNumber } from '../..//package.json';
import { sendStatus } from '.';
import * as child from 'child_process'
import { slideDir } from './server';


function version(): number {
    return parseFloat(versionNumber);
}

function oldVersion(manifest: Manifest): boolean {
    return manifest.version != version();
}

const badDict = 
{
    "2:2": {
      "0": {
        "file": "2_20",
        "duration": 5.616
      },
      "1": {
        "file": "2_21",
        "duration": 6.816
      },
      "2": {
        "file": "2_22",
        "duration": 5.616
      },
      "3": {
        "file": "2_23",
        "duration": 1.536
      },
      "4": {
        "file": "2_24",
        "duration": 2.304
      },
      "5": {
        "file": "2_25",
        "duration": 2.784
      },
      "6": {
        "file": "2_26",
        "duration": 5.016
      },
      "7": {
        "file": "7",
        "duration": 10.704
      },
      "8": {
        "file": "8",
        "duration": 10.536
      },
      "9": {
        "file": "9",
        "duration": 7.464
      },
      "10": {
        "file": "10",
        "duration": 8.856
      },
      "11": {
        "file": "11",
        "duration": 24.576
      }
    },
    "2:29": {
      "0": {
        "file": "2_290",
        "duration": 1.704
      },
      "1": {
        "file": "2_291",
        "duration": 7.824
      },
      "2": {
        "file": "2_292",
        "duration": 10.536
      },
      "3": {
        "file": "2_293",
        "duration": 34.704
      },
      "4": {
        "file": "2_294",
        "duration": 17.064
      },
      "5": {
        "file": "2_295",
        "duration": 16.656
      },
      "6": {
        "file": "2_296",
        "duration": 66.576
      },
      "7": {
        "file": "2_297",
        "duration": 30.216
      },
      "8": {
        "file": "2_298",
        "duration": 8.616
      }
    },
    "2:31": {
      "0": {
        "file": "2_310",
        "duration": 1.344
      },
      "1": {
        "file": "2_311",
        "duration": 5.256
      },
      "2": {
        "file": "2_312",
        "duration": 45.024
      },
      "3": {
        "file": "2_313",
        "duration": 15.096
      },
      "4": {
        "file": "2_314",
        "duration": 38.136
      },
      "5": {
        "file": "5",
        "duration": 19.776
      },
      "6": {
        "file": "2_316",
        "duration": 2.256
      }
    },
    "26:57": {
      "0": {
        "file": "26_570",
        "duration": 1.656
      },
      "1": {
        "file": "1",
        "duration": 8.376
      },
      "2": {
        "file": "2",
        "duration": 5.784
      },
      "3": {
        "file": "3",
        "duration": 7.944
      },
      "4": {
        "file": "4",
        "duration": 46.176
      },
      "5": {
        "file": "5",
        "duration": 3.504
      },
      "6": {
        "file": "6",
        "duration": 35.616
      },
      "7": {
        "file": "7",
        "duration": 0.264
      },
      "8": {
        "file": "26_578",
        "duration": 20.304
      },
      "9": {
        "file": "26_579",
        "duration": 4.464
      },
      "10": {
        "file": "26_5710",
        "duration": 1.104
      },
      "11": {
        "file": "26_5711",
        "duration": 0.696
      }
    },
    "26:179": {
      "0": {
        "file": "0",
        "duration": 7.824
      },
      "1": {
        "file": "1",
        "duration": 61.704
      },
      "2": {
        "file": "2",
        "duration": 2.424
      },
      "3": {
        "file": "3",
        "duration": 7.104
      },
      "4": {
        "file": "4",
        "duration": 28.224
      },
      "5": {
        "file": "5",
        "duration": 0.336
      },
      "6": {
        "file": "6",
        "duration": 13.464
      },
      "7": {
        "file": "7",
        "duration": 0.336
      }
    },
    "26:118": {
      "0": {
        "file": "0",
        "duration": 1.704
      },
      "1": {
        "file": "1",
        "duration": 7.776
      },
      "2": {
        "file": "2",
        "duration": 18.096
      },
      "3": {
        "file": "3",
        "duration": 7.896
      },
      "4": {
        "file": "4",
        "duration": 6.264
      },
      "5": {
        "file": "5",
        "duration": 22.896
      },
      "6": {
        "file": "6",
        "duration": 10.056
      },
      "7": {
        "file": "7",
        "duration": 13.224
      }
    },
    "90:1": {
      "0": {
        "file": "0",
        "duration": 1.296
      },
      "1": {
        "file": "1",
        "duration": 12.696
      },
      "2": {
        "file": "2",
        "duration": 13.824
      },
      "3": {
        "file": "3",
        "duration": 40.944
      },
      "4": {
        "file": "4",
        "duration": 2.904
      },
      "5": {
        "file": "5",
        "duration": 28.056
      },
      "6": {
        "file": "6",
        "duration": 20.856
      },
      "7": {
        "file": "90_17",
        "duration": 29.424
      },
      "8": {
        "file": "90_18",
        "duration": 10.584
      },
      "9": {
        "file": "90_19",
        "duration": 22.416
      }
    },
    "90:309": {
      "0": {
        "file": "90_3090",
        "duration": 2.376
      },
      "1": {
        "file": "90_3091",
        "duration": 37.224
      },
      "2": {
        "file": "90_3092",
        "duration": 37.536
      },
      "3": {
        "file": "90_3093",
        "duration": 23.496
      },
      "4": {
        "file": "90_3094",
        "duration": 34.056
      },
      "5": {
        "file": "90_3095",
        "duration": 43.464
      }
    },
    "33:227": {
      "0": {
        "file": "33_2270",
        "duration": 3.216
      },
      "1": {
        "file": "33_2271",
        "duration": 28.536
      },
      "2": {
        "file": "33_2272",
        "duration": 8.304
      },
      "3": {
        "file": "33_2273",
        "duration": 21.216
      },
      "4": {
        "file": "33_2274",
        "duration": 6.096
      },
      "5": {
        "file": "33_2275",
        "duration": 4.416
      },
      "6": {
        "file": "33_2276",
        "duration": 29.544
      },
      "7": {
        "file": "33_2277",
        "duration": 16.824
      },
      "8": {
        "file": "33_2278",
        "duration": 37.224
      },
      "9": {
        "file": "33_2279",
        "duration": 6.216
      },
      "10": {
        "file": "33_22710",
        "duration": 0.864
      },
      "11": {
        "file": "11",
        "duration": 3.984
      }
    },
    "99:66": {
      "0": {
        "file": "99_660",
        "duration": 2.016
      },
      "1": {
        "file": "99_661",
        "duration": 15.816
      },
      "2": {
        "file": "99_662",
        "duration": 2.136
      }
    },
    "99:76": {
      "0": {
        "file": "99_760",
        "duration": 11.544
      },
      "1": {
        "file": "99_761",
        "duration": 9.936
      },
      "2": {
        "file": "99_762",
        "duration": 8.736
      },
      "3": {
        "file": "99_763",
        "duration": 14.736
      },
      "4": {
        "file": "99_764",
        "duration": 11.256
      },
      "5": {
        "file": "99_765",
        "duration": 2.496
      },
      "6": {
        "file": "99_766",
        "duration": 6.576
      },
      "7": {
        "file": "99_767",
        "duration": 9.264
      },
      "8": {
        "file": "99_768",
        "duration": 0.864
      },
      "9": {
        "file": "99_769",
        "duration": 6.216
      },
      "10": {
        "file": "99_7610",
        "duration": 11.976
      },
      "11": {
        "file": "99_7611",
        "duration": 4.056
      }
    },
    "99:93": {
      "0": {
        "file": "99_930",
        "duration": 4.104
      },
      "1": {
        "file": "99_931",
        "duration": 10.296
      },
      "2": {
        "file": "99_932",
        "duration": 7.104
      },
      "3": {
        "file": "99_933",
        "duration": 49.944
      },
      "4": {
        "file": "99_934",
        "duration": 31.776
      },
      "5": {
        "file": "99_935",
        "duration": 39.576
      },
      "6": {
        "file": "99_936",
        "duration": 16.824
      },
      "7": {
        "file": "99_937",
        "duration": 22.824
      }
    },
    "99:1": {
      "0": {
        "file": "99_10",
        "duration": 1.536
      },
      "1": {
        "file": "99_11",
        "duration": 27.696
      },
      "2": {
        "file": "99_12",
        "duration": 24.864
      },
      "3": {
        "file": "99_13",
        "duration": 6.744
      },
      "4": {
        "file": "4",
        "duration": 4.416
      },
      "5": {
        "file": "5",
        "duration": 2.184
      }
    },
    "99:56": {
      "0": {
        "file": "99_560",
        "duration": 2.184
      },
      "1": {
        "file": "99_561",
        "duration": 7.656
      },
      "2": {
        "file": "99_562",
        "duration": 30.336
      }
    },
    "99:42": {
      "0": {
        "file": "99_420",
        "duration": 1.944
      },
      "1": {
        "file": "99_421",
        "duration": 4.344
      },
      "2": {
        "file": "99_422",
        "duration": 5.064
      },
      "3": {
        "file": "99_423",
        "duration": 15.456
      },
      "4": {
        "file": "99_424",
        "duration": 4.224
      },
      "5": {
        "file": "99_425",
        "duration": 7.824
      },
      "6": {
        "file": "6",
        "duration": 0.144
      },
      "7": {
        "file": "99_427",
        "duration": 8.184
      },
      "8": {
        "file": "99_428",
        "duration": 0.576
      },
      "9": {
        "file": "99_429",
        "duration": 28.176
      },
      "10": {
        "file": "99_4210",
        "duration": 5.136
      }
    },
    "99:13": {
      "0": {
        "file": "99_130",
        "duration": 1.896
      },
      "1": {
        "file": "99_131",
        "duration": 30.696
      },
      "2": {
        "file": "99_132",
        "duration": 11.376
      },
      "3": {
        "file": "99_133",
        "duration": 12.024
      },
      "4": {
        "file": "99_134",
        "duration": 1.824
      },
      "5": {
        "file": "99_135",
        "duration": 10.584
      },
      "6": {
        "file": "99_136",
        "duration": 6.576
      },
      "7": {
        "file": "99_137",
        "duration": 28.176
      },
      "8": {
        "file": "99_138",
        "duration": 9.984
      },
      "9": {
        "file": "99_139",
        "duration": 16.944
      },
      "10": {
        "file": "99_1310",
        "duration": 17.736
      },
      "11": {
        "file": "99_1311",
        "duration": 23.184
      }
    },
    "2:37": {
      "0": {
        "file": "2_370"
      },
      "1": {
        "file": "2_371"
      },
      "2": {
        "file": "2_372"
      },
      "3": {
        "file": "2_373"
      },
      "4": {
        "file": "2_374"
      },
      "5": {
        "file": "2_375"
      },
      "6": {
        "file": "2_376"
      },
      "7": {
        "file": "2_377"
      },
      "8": {
        "file": "2_378"
      }
    },
    "114:10": {
      "0": {
        "file": "114_100"
      },
      "1": {
        "file": "114_101"
      },
      "2": {
        "file": "114_102"
      },
      "3": {
        "file": "114_103"
      },
      "4": {
        "file": "114_104"
      },
      "5": {
        "file": "114_105"
      },
      "6": {
        "file": "114_106"
      }
    },
    "114:86": {
      "0": {
        "file": "114_860"
      },
      "1": {
        "file": "114_861"
      },
      "2": {
        "file": "114_862"
      },
      "3": {
        "file": "114_863"
      },
      "4": {
        "file": "114_864"
      }
    },
    "114:2": {
      "0": {
        "file": "114_20"
      },
      "1": {
        "file": "114_21"
      },
      "2": {
        "file": "114_22"
      },
      "3": {
        "file": "114_23"
      },
      "4": {
        "file": "114_24"
      },
      "5": {
        "file": "114_25"
      },
      "6": {
        "file": "114_26"
      }
    },
    "372:2": {
      "0": {
        "file": "0",
        "duration": 2.736
      },
      "1": {
        "file": "1",
        "duration": 0.816
      },
      "2": {
        "file": "2",
        "duration": 9.264
      },
      "3": {
        "file": "3",
        "duration": 19.176
      },
      "4": {
        "file": "4",
        "duration": 27.864
      },
      "5": {
        "file": "5",
        "duration": 21.816
      }
    },
    "372:13": {
      "0": {
        "file": "0",
        "duration": 1.416
      },
      "1": {
        "file": "1",
        "duration": 10.704
      },
      "2": {
        "file": "2",
        "duration": 16.776
      },
      "3": {
        "file": "3",
        "duration": 15.336
      },
      "4": {
        "file": "4",
        "duration": 27.576
      },
      "5": {
        "file": "5",
        "duration": 44.904
      },
      "6": {
        "file": "6",
        "duration": 35.424
      },
      "7": {
        "file": "7",
        "duration": 46.296
      },
      "8": {
        "file": "8",
        "duration": 54.456
      },
      "9": {
        "file": "9",
        "duration": 1.536
      }
    },
    "389:0": {
      "0": {
        "file": "0",
        "duration": 1.584
      },
      "1": {
        "file": "1",
        "duration": 7.104
      },
      "2": {
        "file": "2",
        "duration": 17.856
      },
      "3": {
        "file": "3",
        "duration": 15.216
      },
      "4": {
        "file": "4",
        "duration": 6.504
      },
      "5": {
        "file": "5",
        "duration": 33.264
      },
      "6": {
        "file": "6",
        "duration": 12.936
      },
      "7": {
        "file": "7",
        "duration": 7.224
      },
      "8": {
        "file": "8",
        "duration": 7.176
      },
      "9": {
        "file": "9",
        "duration": 11.616
      },
      "10": {
        "file": "10",
        "duration": 26.256
      },
      "11": {
        "file": "11",
        "duration": 8.784
      },
      "12": {
        "file": "12",
        "duration": 18.816
      },
      "13": {
        "file": "13",
        "duration": 3.144
      },
      "14": {
        "file": "14",
        "duration": 5.064
      }
    },
    "389:27": {
      "0": {
        "file": "0",
        "duration": 7.056
      },
      "1": {
        "file": "1",
        "duration": 23.544
      },
      "2": {
        "file": "2",
        "duration": 6.696
      },
      "3": {
        "file": "3",
        "duration": 11.376
      },
      "4": {
        "file": "4",
        "duration": 3.384
      },
      "5": {
        "file": "5",
        "duration": 12.744
      },
      "6": {
        "file": "6",
        "duration": 14.784
      },
      "7": {
        "file": "7",
        "duration": 4.536
      },
      "8": {
        "file": "8",
        "duration": 28.584
      },
      "9": {
        "file": "9",
        "duration": 6.456
      },
      "10": {
        "file": "10",
        "duration": 23.136
      }
    },
    "423:86": {
      "0": {
        "file": "0",
        "duration": 2.016
      },
      "1": {
        "file": "1",
        "duration": 42.456
      },
      "2": {
        "file": "2",
        "duration": 23.136
      },
      "3": {
        "file": "3",
        "duration": 5.904
      },
      "4": {
        "file": "4",
        "duration": 8.304
      },
      "5": {
        "file": "5",
        "duration": 44.544
      },
      "6": {
        "file": "6",
        "duration": 7.704
      },
      "7": {
        "file": "7",
        "duration": 1.176
      },
      "8": {
        "file": "8",
        "duration": 53.184
      }
    }
}

function upgradeManifest(manifest: Manifest): void {

    if (manifest.version == version())
        return;

    if (manifest.version < 0.89) {
        console.log('nothing')

        //add keywords to all slides
        // eslint-disable-next-line no-inner-declarations
        function eventIdAdd(event: ZoomEvent) {
            for (let i = 0; i < event.children.length; i++) {
                const child = event.children[i];
                child.eventId = i.toString();
                if (child.type == 'child')
                    eventIdAdd(child);
            }
        }

        eventIdAdd(manifest.tree);
        manifest.tree.eventId = 'root';

    }

    if (manifest.version < 0.902) {
        for (const slide of Object.keys(manifest.soundDict)) {
            const dict = manifest.soundDict[slide]
            const events = Object.keys(dict);
            for (const event of events)
                dict[event] = (dict[event] as any).duration;

            const oldKey = (events.length - 1).toString();
            dict['finish'] = dict[oldKey];
            delete dict[oldKey];
            const dir = slideDir(manifest, slide);
            try {child.execSync(`mv ${dir}/${oldKey}.mp3 ${dir}/finish.mp3 `);}
            catch (e) {console.log('failed to copy file',e)}
        }
    }






    sendStatus('Upgraded ' + manifest.presentation)
    manifest.version = version();

}