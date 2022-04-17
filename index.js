/**
 * openHAB ECMAScript (262 Edition 11) lights module
 * @module module-lights
 */

'use strict';

/*******************************************************************************
*******************************************************************************/

function p_rgb_to_string(rgb) {

    if (isNaN(rgb.r) || rgb.r < 0 || rgb.r > 255) { return null; }
    if (isNaN(rgb.g) || rgb.g < 0 || rgb.g > 255) { return null; }
    if (isNaN(rgb.b) || rgb.b < 0 || rgb.b > 255) { return null; }

    return rgb.r.toString()+","+rgb.g.toString()+","+rgb.b.toString();

}

function p_string_to_rgb(rgb_string) {

    let values = rgb_string.split(",");

    if (values.length != 3) { return null; }

    let red = parseInt(values[0].trim());
    if (isNaN(red) || red < 0 || red > 255) { return null; }

    let green = parseInt(values[1].trim());
    if (isNaN(green) || green < 0 || green > 255) { return null; }

    let blue = parseInt(values[2].trim());
    if (isNaN(blue) || blue < 0 || blue > 255) { return null; }

    return { r: red, g: green, b: blue };

}

function p_hash(str) {
    for (let i = 0, h = 0; i < str.length; i++)
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    return h;
}

/*******************************************************************************
*******************************************************************************/

function p_calculate_follow_daylight(item_names, parameters) {

    const max_color_temp = parameters.max_color_temp || 5500; //5500
    const min_color_temp = parameters.min_color_temp || 2500; //2500
    const max_brightness = parameters.max_brightness || 100; //100
    const min_brightness = parameters.min_brightness || 30; //30

    const seconds_per_day = 86400;

    var sunrise = new Date(items.getItem(item_names.sunrise).state).getTime() / 1000;
    var sunset = new Date(items.getItem(item_names.sunset).state).getTime() / 1000;
    var solar_noon = sunrise + (sunset - sunrise) / 2;
    var solar_midnight = sunset + ((sunrise + seconds_per_day) - sunset) / 2;
    var now = new Date().getTime() / 1000;
    var today_times = {SUNRISE: sunrise, SUNSET: sunset, SOLAR_NOON: solar_noon, SOLAR_MIDNIGHT: solar_midnight};
    var yesterday_times = {};
    var tomorrow_times = {};

    if (now < today_times.SUNRISE) {

        yesterday_times = {SUNRISE: sunrise-seconds_per_day, SUNSET: sunset-seconds_per_day, SOLARNOON: solar_noon-seconds_per_day, SOLARMIDNIGHT: solar_midnight-seconds_per_day};
        sunset = yesterday_times.SUNSET;

        if (today_times.SOLAR_MIDNIGHT > today_times.SUNSET && yesterday_times.SOLAR_MIDNIGHT > yesterday_times.SUNSET) {
            solar_midnight = yesterday_times.SOLAR_MIDNIGHT;
        }

    } else if (now > today_times.SUNSET) {

        //Because it's after sunset (and before midnight) sunrise should happen tomorrow
        tomorrow_times = {SUNRISE: sunrise+seconds_per_day, SUNSET: sunset+seconds_per_day, SOLAR_NOON: solar_noon+seconds_per_day, SOLAR_MIDNIGHT: solar_midnight+seconds_per_day};

        sunrise = tomorrow_times.SUNRISE;
        if (today_times.SOLAR_MIDNIGHT < today_times.SUNRISE && tomorrowTimes.SOLAR_MIDNIGHT < tomorrowTimes.SUNRISE) {
            // Solar midnight is before sunrise so use tomorrow's time
            solar_midnight = tomorrow_times.SOLAR_MIDNIGHT;
        }

    }

    var h = 0;
    var k = 0;
    var x = 0;
    var y = 0;

    if ((now > sunrise) && (now < sunset)) {

        h = solar_noon;
        k = 100;
        y = 0;
        if (now < solar_noon) {
            x = sunrise;
        } else {
            x = sunset;
        }

    } else if ((now > sunset) && (now < sunrise)) {

        h = solar_midnight;
        k = -100;
        y = 0;
        if (now < solar_midnight) {
            x = sunset;
        } else {
            x = sunrise;
        }

    }

    const a = (y-k) / Math.pow((h-x), 2);
    const prc = a * Math.pow((now-h), 2) + k;

    var clt;
    var bri;

    if (prc > 0) {
        clt = ((max_color_temp - min_color_temp) * (prc / 100)) + min_color_temp;
        bri = max_brightness;
    } else {
        clt = min_color_temp;
        bri = ((max_brightness - min_brightness) * ((100+prc) / 100)) + min_brightness;
    }

    return {brightness: Math.round(bri), color_temperature: Math.round(clt)};

}

/*******************************************************************************
*******************************************************************************/

function p_set_manual(item_names, program) {

    if (program.brightness !== undefined && Number.isInteger(program.brightness) && program.brightness >= 0 && program.brightness <= 100) {
        items.getItem(item_names.brightness).sendCommandIfDifferent(program.brightness.toString());
    }

    if (program.color_temperature !== undefined && Number.isInteger(program.color_temperature) && program.color_temperature >= 2200 && program.color_temperature <= 6500) {
        items.getItem(item_names.color_temperature).sendCommandIfDifferent(program.color_temperature.toString());
    }

    if (program.color !== undefined) {
        items.getItem(item_names.color).sendCommandIfDifferent(p_rgb_to_string(program.color));
    }

}

function p_set_dynamic(item_names, program) {

    var result_program;

    switch (program.name) {

        case "FollowDaylight" :
            result_program = p_calculate_follow_daylight(item_names, program);
            break;

    }

    if (result_program) {
        p_set_manual(item_names, result_program);
    }

}

function p_set_program(item_names, program) {

    if (program.type === "huescene") {

        items.getItem(item_names.scene).sendCommand(program.scene_id);

    } else if (program.type === "manual") {

        p_set_manual(item_names, program);

    } else if (program.type === "dynamic") {

        p_set_dynamic(item_names, program);

    }

}

/*******************************************************************************
*******************************************************************************/

/**
 * Switches a light on (if it is off) or iterate through a set of programs (if it is on)
 * @param {Object} item_names - Dictionary of the openHAB control item names.
 * @param {Object} programs - List of the programs.
 * @param {number} program_index - (optional) Activate program by program_index if the light is off. If the light is already on, activate next program from the list (iteration function).
 * @param {boolean} block_iterating - (optional) Set the program, but do not iterate if there is more than one program. If there is only one program do nothing.
 */
exports.switch_on = function(item_names, programs, program_index, block_iterating) {

    programs = (Array.isArray(programs)) ? programs : [];
    program_index = (typeof program_index === "number") ? program_index : -1;
    block_iterating = (typeof block_iterating === "boolean") ? block_iterating : false;

    let id = p_hash(item_names.switch);

    let index_map = cache.get("lights_program_index_map");
    if (index_map == null) {
        index_map = { map: new Map() };
        cache.put("lights_program_index_map", index_map);
    }

    const state = items.getItem(item_names.switch).state;

    if (state === "ON") {

        if (programs.length > 1 && !block_iterating) {

            var index = index_map.map.get(id);
            if (index == null) {
                index_map.map.set(id, index);
            }

            var i = 0;
            if ((Number.isInteger(index)) && (index >= 0) && (index < programs.length-1)) {
                i = index+1;
            }

            p_set_program(item_names, programs.find(function(program) { return program.index === i; }));

            index_map.map.set(id, i);
            cache.put("lights_program_index_map", index_map);

        }

    } else if (state === "OFF") {

        if (program_index >= 0 && program_index < programs.length) {
            p_set_program(item_names, programs.find(function(program) { return program.index === program_index; }));
            index_map.map.set(id, program_index);
            cache.put("lights_program_index_map", index_map);
        }

        items.getItem(item_names.switch).sendCommand("ON");

    }

}

/**
 * Switches a light off
 * @param {Object} item_names - Dictionary of the openHAB control item names.
 */
exports.switch_off = function(item_names) {

    items.getItem(item_names.switch).sendCommand("OFF");

}

/**
 * Dims a light up in 20% steps
 * @param {Object} item_names - Dictionary of the openHAB control item names.
 */
exports.dim_up = function(item_names) {

    const bri = parseInt(items.getItem(item_names.brightness).state);
    if (isNaN(bri)) { return; }

    if (bri < 100) {
        // round to the next twenty
        items.getItem(item_names.brightness).sendCommandIfDifferent((Math.ceil((bri+1) / 20) * 20).toString());
    }

}

/**
 * Dims a light down in 20% steps
 * @param {Object} item_names - Dictionary of the openHAB control item names.
 */
exports.dim_down = function(item_names) {

    const bri = parseInt(items.getItem(item_names.brightness).state);
    if (isNaN(bri)) { return; }

    if (bri > 20) {
        // round to the previous twenty
        items.getItem(item_names.brightness).sendCommandIfDifferent((Math.floor((bri-1) / 20) * 20).toString());
    } else if (bri > 1) {
        items.getItem(item_names.brightness).sendCommandIfDifferent("1");
    }

}

/**
 * Checks if a light is switched on
 * @param {Object} item_names - Dictionary of the openHAB control item names.
 * @returns {boolean}
 */
exports.is_on = function(item_names) {

    return (items.getItem(item_names.switch).state === "ON");

}

/**
 * Checks if a light is switched off
 * @param {Object} item_names - Dictionary of the openHAB control item names.
 * @returns {boolean}
 */
exports.is_off = function(item_names) {

    return (items.getItem(item_names.switch).state === "OFF");

}

/**
 * Updates values of a dynamic program and the lights
 * @param {Object} item_names - Dictionary of the openHAB control item names.
 * @param {Object} program - The program definition incl. the parameters
 * @param {boolean} only_if_switched_on - Update only if the light is switched on
 * @returns {boolean}
 */
exports.update_items_by_dynamic_mode = function(item_names, program, only_if_switched_on) {

    only_if_switched_on = (typeof only_if_switched_on !== "undefined" && typeof only_if_switched_on === "boolean") ? only_if_switched_on : true;

    if (only_if_switched_on && (this.is_off(item_names))) return;

    var result_program;

    switch (program.name) {

        case "follow_daylight" :
            result_program = p_calculate_follow_daylight(program);
            break;

    }

    if (result_program) {
        items.getItem(item_names.brightness).sendCommandIfDifferent(result_parameters.brightness.toString());
        if (item_names.color_temperature) {
            items.getItem(item_names.color_temperature).sendCommandIfDifferent(result_parameters.color_temperature.toString());
        }
    }

}
