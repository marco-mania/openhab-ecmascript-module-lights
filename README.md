# openHAB ECMAScript Module lights

Collection of light control functions for ECMAScript 262 Edition 11 defined
rules in openHAB.

## Installation

Create folder `/conf/automation/js/node_modules/lights` and copy `index.js` to
this folder.

## Usage

To include the module in your JSRule:

    let lights = require("lights");
    lights.myfunction(...);

To use the functions of this module, first create item_names dictonary of the
relevant openHAB items. For example, if you have a philips hue light with color
temperature (Kelvin) capabilities, your items might named like this:

    item_names: {
        switch: "HueLight_Bedroom_Switch",
        brightness: "HueLight_Bedroom_Brightness",
        color_temperature: "HueLight_Bedroom_ColorTemperature",
        color: "HueLight_Bedroom_Color",
        scene: "HueLight_Bedroom_Scene",
        sunrise: "LocalSundata_Rise_Start",
        sunset: "LocalSundata_Set_Start"
    }

If your light does not support color temperature, just do not define the
`colortemperature` key. Also with the `brightness` key.
If you have RGB capabilities, use the key `color` to define the corresponding
item. For some cases you need sunrise and sunset information from the astro
binding items. If so, also set the keys `sunrise` and `sunset`.

You can now define an array of dictionaries to describe your program set, e.g.:

    programs: [
        { index: 0, type: "manual", brightness: 80, color_temperature: 3000 },
        { index: 1, type: "manual", brightness: 80, color: "211,211,211" },
        { index: 2, type: "huescene", scene_id: "Iif5evah4Aewa0m" },
        { index: 3, type: "huescene", scene_id: "nuSh0riepieci1L" },
        { index: 4, type: "dynamic", name: "FollowDaylight", min_color_temp: 3000, max_color_temp: 5500, min_brightness: 30, max_brightness: 100 }
    ]

### Function switch_on

You are now ready to use the `switch_on` function in your JSRule:

    lights.switch_on(item_names, programs)

First time you use the function to switch on your light, program with index 0
will be activated. If you call the function a second time, program index will be
increased by 1 und program index 1 will be used. If you are at index 4, the next
step will be program with index 0 again. The index will be saved in the openHAB
cache, so it will be persistent as long as openHAB is running.
You can manipluate this behaviour with two optional parameters.

    lights.switch_on(item_names, programs, program_index, block_iterating)

With `program_index` you can enforce a starting program index, if the light is
switched off, ignoring the possibly existing index at the cache. This might be
useful for automated light activation.
`block_iterating` does not iterate the program index, if the light is already
on. This might also be useful automated light activation.

### Program types

The program types are:

* `manual`
* `huescene`
* `dynamic`

#### Program type manual

Set the keys, depending what your lights support, `brightness`,
`color_temperature` or `color`.
The unit for brightness is percent, for color_temperature Kelvin in the range
from 2200 to 6500 and color is a RGB string of three comma separated byte values
like this: `255,0,0`.

#### Program type huescene

Usually within the hue app you can define hue scenes. Those hue scenes have
scene id's like `Iif5evah4Aewa0m`. Just set the key `scene_id`.

You can't see those id's within the official hue app. To retrieve a list of the
hue scene indices first open the openHAB client console:

    /openhab/runtime/bin/client
    # or in case of a running docker container:
    docker exec -it @container-name /openhab/runtime/bin/client

and run this command:

    hue @uid scenes

Find the `@uid` in the openHAB thing configuration for the hue bridge (e.g.
`hue:bridge:ecb3fd181cdd`).

#### Program type dynamic

Dynamic light scenes. To use those you additional need an update JSRule:

To use it, you also need a JSRule like this, which updates the switched on
lights every 5 minutes. For example:

    rules.JSRule({
        name: "update-dynamic-lights",
        description: "",
        triggers: [
            triggers.GenericCronTrigger("0 0/5 * * * ? *")
        ],
        execute: data => {
            let item_names = { ... }
            let program = { name: "ProgramName", parameter1: ..., parameter2: ... };
            let lights = require("lights");
            lights.update_items_by_dynamic_mode(item_names, program, true);
        }
    }

The last parameter of the function `update_items_by_dynamic_mode` indicates
whether the values should also being calculated and set if the light is
switched on. Depending on your hardware it could be that the light is switched
on every time a calculation happens.

##### FollowDaylight

By now there's only one dynamic program called `FollowDaylight`, which will set
brightness and color temperatur depending on the position of the sun at your
location. Sunrise and sunset are retrieved over corresponding items set by the
astro binding in openHAB. Please set the correct item names (see above).

At midnight `min_color_temp` and `min_brightness` are used. At noon
`max_color_temp` and `max_brightness`. Between those limits the values are
"swinging" depending on the position of the sun.

### Function switch_off

Switches the light off. For example:

    lights.switch_on(item_names);

For this function you only need the item names.

### Function dim_up

Dims up your light to the next twenty multiple. For example:

    lights.dim_up(item_names);

For this function you only need the item names.

### Function is_on

Checks if your light is on.

    if (lights.is_on(item_names)) { ... }

For this function you only need the item names.

### Function is_off

Checks if your light is off.

    if (lights.is_off(item_names)) { ... }

For this function you only need the item names.
