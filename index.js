/** Hue Z-Way HA module *******************************************

Version: 0.98
(c) Minux, 2016
-----------------------------------------------------------------------------
Authors: Ludovic.F, Tim Auton
Description:
    This module creates a Light widget

******************************************************************************/

// ----------------------------------------------------------------------------
// --- Class definition, inheritance and setup
// ----------------------------------------------------------------------------

function Hue(id, controller) {
    Hue.super_.call(this, id, controller);
}

inherits(Hue, AutomationModule);

_module = Hue;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------
Hue.prototype.init = function(config) {

    console.log("Hue Init Devices");
    Hue.super_.prototype.init.call(this, config);

    var self = this;
    
    this.authenticate(self);
    
    this.timer = setInterval(function() {
		self.refreshAllHueLights(self);
    }, 30 * 1000);
};

Hue.prototype.stop = function() {
    Hue.super_.prototype.stop.call(this);

    if (this.timer) {
        clearInterval(this.timer);
    }

    var filterId = "Hue_" + this.id,
        filterArray = this.controller.devices.filter(function(device) {
            return device.id.indexOf(filterId) > -1;
        });

    filterArray.forEach(function(device) {
        console.log("Hue Remove Device" + device.id);
        this.controller.devices.remove(device.id);
    });

};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

Hue.prototype.authenticate = function(self) {
    console.log("Hue Authenticate Devices");

    var app_ip = self.config.ip,
        app_key = self.config.key,
        moduleName = "Hue",
        langFile = self.controller.loadModuleLang(moduleName),
        url = "http://" + app_ip + "/api/" + app_key;

    http.request({
        url: url,
        method: "GET",
        headers: { "Content-type": "application/json;charset=UTF-8" },
        data: {},
        async: true,
        success: function(rsp) {
            console.log("PhilispHue Connection Authenticate OK -> " + JSON.stringify(rsp));
            self.createDevices(self, rsp.data);
        },
        error: function(rsp) {
            console.log("PhilispHue Erreur Connection Authenticate: " + url);
        },
        complete: function(rsp) {
            console.log("PhilispHue Finished Auth: " + url);
        }
    });
};


Hue.prototype.createDevices = function(self, jsonData) {
    console.log("Hue Create Devices");
    var moduleName = "Hue";
    var deviceLights = jsonData.lights;
    for (var lightId in deviceLights) {
        var state = deviceLights[lightId].state.on;
        var brightness = deviceLights[lightId].state.bri;
        var name = deviceLights[lightId].name;
		var reachable = deviceLights[lightId].state.reachable;
        
        if (deviceLights[lightId].type == "Color temperature light") {
        	var ct = deviceLights[lightId].state.ct;
        	if (!self.config.noSwitch) {
        		self.createHueDevice("lights", lightId, name, state, reachable, "switchBinary", "sb");
        	}
        	self.createHueDevice("lights", lightId, name, state, reachable, "switchMultilevel", "bri");
        	self.createHueAmbientDevice("lights", lightId, name + " Color Temperature", ct, reachable);
        }
        else {
            var color = deviceLights[lightId].state.hue;
            var saturation = deviceLights[lightId].state.sat;
            
			if (self.config.forceSwitchMultilevel && !self.config.noSwitch) {
				self.createHueDevice("lights", lightId, name, state, reachable, "switchBinary", "sb");
			}
			if (!self.config.forceSwitchMultilevel) {
				self.createHueColorDevice("lights", lightId, name, state, reachable);
			}
			self.createHueDevice("lights", lightId, name + " Saturation", state, reachable, "switchMultilevel", "sat");
			self.createHueDevice("lights", lightId, name + " Brightness", state, reachable, "switchMultilevel", "bri");
		}
    }

    if (self.config.importScenes) {
        var deviceGroups = jsonData.groups;
        var deviceScenes = jsonData.scenes;
        for (var groupId in deviceGroups) {
            var grpName = deviceGroups[groupId].name,
                lights = deviceGroups[groupId].lights;

            for (var sceneId in deviceScenes) {
                var sceneName = deviceScenes[sceneId].name;

                self.createGroupSceneDevice("groups", groupId, grpName, sceneId, sceneName, lights);
            }
        }
    }
};

Hue.prototype.createHueColorDevice = function(type, id, name, state, reachable) {

    var self = this;
    var hueLevel = (reachable == true) ? ((state == true) ? "on" : "off") : null;

    console.log("PhilispHue createHueColorDevice " + name + "(" + type + id + ")-> State(" + state + ") Reachable(" + reachable + ") HueLevel(" + hueLevel + ")");

    var vDev = self.controller.devices.create({
        deviceId: "Hue_" + this.id + "_" + type + "_" + id,
        defaults: {
            deviceType: "switchRGBW",
            metrics: {
                title: name,
                icon: "/ZAutomation/api/v1/load/modulemedia/Hue/bulbc.png",
                level: hueLevel,
                color: { r: 255, g: 255, b: 255 }
            }
        },
        overlay: {},
        handler: function(command, args) {
            //console.log("PhilispHue Color Handler " + name + "(" + type + id + ")-> Command(" + command + ") Args(" + args + ")");
            if (command === "on") self.sendAction(type, id, { "on": true }, "state", null);
            if (command === "off") self.sendAction(type, id, { "on": false }, "state", null);
            if (command === "exact") {
                var xy = self.toXY(args.red, args.green, args.blue),
                    currentDevice = self.controller.devices.get("Hue_" + self.id + "_" + type + "_" + id),
                    isLighting = currentDevice.get("metrics:level");
                if (isLighting == "off") {
                    self.sendAction(type, id, { "on": true, "xy": xy, "transitiontime": self.config.transitionTime }, "state", null);
                } else {
                    self.sendAction(type, id, { "xy": xy, "transitiontime": self.config.transitionTime }, "state", null);
                }
            }
        },
        moduleId: this.id
    });
};

Hue.prototype.createHueAmbientDevice = function(type, id, name, hueCT, reachable) {

    var self = this;

    console.log("PhilispHue createHueAmbientDevice " + name + "(" + type + id + ")-> Reachable(" + reachable + ") HueCT(" + hueCT + ")");

	var ctVal = Math.round((500-hueCT)/347*99);

    var vDev = self.controller.devices.create({
        deviceId: "Hue_" + this.id + "_" + type + "_" + id + "_ct",
        defaults: {
            deviceType: "switchMultilevel",
            metrics: {
                title: name,
                icon: "/ZAutomation/api/v1/load/modulemedia/Hue/bulbc.png",
                level: ctVal
            }
        },
        overlay: {},
        handler: function(command, args) {
            if (command === "exact") {
            	// Mired Color Temp
            	// 2000K = 500
            	// 6500K = 153
            	var ct = Math.round(500 - (args.level/99*347));
            	self.sendAction(type, id, { "ct": ct, "transitiontime": self.config.transitionTime  }, "state", null);
            }
        },
        moduleId: this.id
    });
};


Hue.prototype.createHueDevice = function(type, id, name, state, reachable, virtualDevice, subType) {

    var self = this;
    var hueLevel = (reachable == true) ? ((state == true) ? "on" : "off") : null;

    console.log("PhilispHue createHueDevice " + name + "(" + type + id + ")-> State(" + state + ") Reachable(" + reachable + ") HueLevel(" + hueLevel + ")");

    var vDev = self.controller.devices.create({
        deviceId: "Hue_" + this.id + "_" + type + "_" + id + "_" + subType,
        defaults: {
            deviceType: virtualDevice,
            metrics: {
                title: name,
                icon: "/ZAutomation/api/v1/load/modulemedia/Hue/whitebulb.png",
                level: hueLevel,
                change: ''
            }
        },
        overlay: {},
        handler: function(command, args) {
            //console.log("PhilispHue Handler " + name + "(" + type + id + ")-> Command(" + command + ") Args(" + args + ")");
            if (command === "on") self.sendAction(type, id, { "on": true, "transitiontime": self.config.transitionTime }, "state", null);
            if (command === "off") self.sendAction(type, id, { "on": false, "transitiontime": self.config.transitionTime }, "state", null);
            if (command === "exact") {
                var num = self.toHueBriSat(args.level);
                var currentDevice = self.controller.devices.get("Hue_" + self.id + "_" + type + "_" + id + "_" + subType);
                var isLighting = !(currentDevice.get("metrics:level")=="off");
                
                if (subType == "bri" && args.level == 0) {
                	self.sendAction(type, id, { "on": false, "transitiontime": self.config.transitionTime }, "state", null);
                } else {
                    if (isLighting) {
                    	if (subType == "bri") {
							self.sendAction(type, id, { "on": true, "bri": num, "transitiontime": self.config.transitionTime }, "state", null);
						} else if (subType == "sat") {
							self.sendAction(type, id, { "on": true, "sat": num, "transitiontime": self.config.transitionTime }, "state", null);
						}
					} else {
						if (subType == "bri") {
							self.sendAction(type, id, { "bri": num, "transitiontime": self.config.transitionTime }, "state", null);
						} else if (subType == "sat") {
							self.sendAction(type, id, { "sat": num, "transitiontime": self.config.transitionTime }, "state", null);
						}
					}
                }
            }
            if (command === "update") {
                self.sendAction(type, id, { "on": true, "bri": 254, "hue": 14910, "sat": 144, "effect": "none", "xy": [0.4596, 0.4105], "ct": 369, "alert": "none", "colormode": "ct" }, "state", null);
            }
        },
        moduleId: this.id
    });
};

Hue.prototype.createGroupSceneDevice = function(type, grpId, grpName, sceneId, sceneName, lights) {

    var self = this;

    console.log("PhilispHue CreateGroupSceneDevice " + grpName + "(" + type + grpId + ")-> sceneId(" + sceneName + " " + sceneId + ")");

    var vDev = self.controller.devices.create({
        deviceId: "Hue_" + this.id + "_" + type + "_" + grpId + "_" + sceneId,
        defaults: {
            deviceType: "toggleButton",
            metrics: {
                title: grpName + " " + sceneName,
                icon: "",
                level: "off",
                lights: lights
            }
        },
        overlay: {},
        handler: function(command, args) {
            if (command === "on") self.sendAction(type, grpId, { "scene": sceneId }, "action", sceneId);
        },
        moduleId: this.id
    });
};

Hue.prototype.sendAction = function(type, number, action, command, addId) {

    var self = this;

    var app_ip = self.config.ip,
        app_key = self.config.key,
        moduleName = "Hue",
        langFile = self.controller.loadModuleLang(moduleName),
        url = "http://" + app_ip + "/api/" + app_key + "/" + type + "/" + number + "/" + command;

    console.log("PhilipsHue Http sendAction-> " + url + " Action:" + JSON.stringify(action));

    http.request({
        url: url,
        method: "PUT",
        headers: { "Content-type": "application/json;charset=UTF-8" },
        data: JSON.stringify(action),
        async: true,
        success: function(rsp) {
            console.log("PhilipsHue Send Action Success:" + JSON.stringify(rsp.data));
            var values = rsp.data[0];
            if (values.success != undefined) {
                var success = values.success,
                    device = self.controller.devices.get("Hue_" + self.id + "_" + type + "_" + number + ((addId != null) ? ("_" + addId) : ""));
                for (var key in success) {
                    if (key == ("/" + type + "/" + number + "/" + command + "/on")) {
                        device.set("metrics:level", (success[key] == true) ? "on" : "off");
                    } else if (key == ("/" + type + "/" + number + "/" + command + "/xy")) {
                        // perform command execute le handler de create device (!! boucle infini !!) i lfaut utuliser set.
                        //device.performCommand('exact', { red: 255, green: 255, blue: 255 });
                    } else if (key == ("/" + type + "/" + number + "/" + command + "/scene")) {
                        var arrayLight = device.get("metrics:lights");
                        arrayLight.forEach(function(element) {
                            var devLight = self.controller.devices.get("Hue_" + self.id + "_lights_" + element);
                            devLight.set("metrics:level", "on");
                        });
                    }
                }
            } else {
                self.controller.addNotification("error", "PhilipsHue " + JSON.stringify(values), "connection", "Hue");
            }
        },
        error: function(rsp) {
            console.log("PhilipsHue Send Action Erreur" + JSON.stringify(action));
            self.controller.addNotification("error", "PhilipsHue Send Action Error", "connection", "Hue");
        },
        complete: function(rsp) {
            //console.log("PhilipsHue Finished Send Action"); 
        }
    });

};

Hue.prototype.refreshAllHueLights = function(self) {
   
    console.log("Phillips Hue Refresh All Hue Lights");

    var url = "http://" + self.config.ip + "/api/" + self.config.key + "/lights";
    
    http.request({
        url: url,
        method: "GET",
        headers: { "Content-type": "application/json;charset=UTF-8" },
        data: {},
        async: true,
        success: function(rsp) {
        	//console.log(rsp);
        	for (var lightId in rsp.data) {
        					
				var filterId = "Hue_" + self.id + "_lights_" + lightId;
				
				//console.log("Hue filterId is " + filterId);
				
				filterArray = self.controller.devices.filter(function(device) {
					return device.id.indexOf(filterId) > -1;
				});

				filterArray.forEach(function(device) {
					//console.log("Hue refreshing " + device.id);
					self.refreshHueLight(device,lightId,rsp);
				});
			}
        },
        error: function(rsp) {
            console.log("Phillisp Hue Error Refresh Hue: " + url);
        }
    });

};

Hue.prototype.refreshHueLight = function(device,lightId,rsp) {

    var res = device.id.split("_");
	var subType = (res.length>4) ? res[4] : null;
    var reachable = rsp.data[lightId].state.reachable;
	var newLevel;
	
	switch (subType) {
		case "bri":
			newLevel = Math.round(rsp.data[lightId].state.bri/254*99);
			if (!rsp.data[lightId].state.on) {
				newLevel = 0;
			} else if (newLevel == 0) {
				// low values can be rounded down to zero, but we don't want that
				newLevel = 1;
			}
			break;
		case "ct":
			newLevel = Math.round((500-rsp.data[lightId].state.ct)/347*99);
			break;
		case "sat":
			newLevel = Math.round(rsp.data[lightId].state.sat/254*99);
			break;
		// TODO: read back X,Y values for RGB bulbs
		default:
			newLevel = ((rsp.data[lightId].state.on) ? "on" : "off");
			break;
	}
	
	if (device.get("metrics:level") != newLevel) {
		device.set("metrics:level",newLevel);
	}
	

};



Hue.prototype.toXY = function(red, green, blue) {
    //Gamma correctie
    red = (red > 0.04045) ? Math.pow((red + 0.055) / (1.0 + 0.055), 2.4) : (red / 12.92);
    green = (green > 0.04045) ? Math.pow((green + 0.055) / (1.0 + 0.055), 2.4) : (green / 12.92);
    blue = (blue > 0.04045) ? Math.pow((blue + 0.055) / (1.0 + 0.055), 2.4) : (blue / 12.92);

    //Apply wide gamut conversion D65
    var X = red * 0.664511 + green * 0.154324 + blue * 0.162028;
    var Y = red * 0.283881 + green * 0.668433 + blue * 0.047685;
    var Z = red * 0.000088 + green * 0.072310 + blue * 0.986039;

    var fx = X / (X + Y + Z);
    var fy = Y / (X + Y + Z);
    //if (isnan(fx)) {
    //fx = 0.0f;
    //}
    //if (isnan(fy)) {
    //fy = 0.0f;
    //}
    var result = [];
    result.push(parseFloat(fx.toPrecision(4)));
    result.push(parseFloat(fy.toPrecision(4)));
    return result;
};

Hue.prototype.toHueBriSat = function(value) {
    var result = (value * 254) / 99;
    return parseInt(Math.round(result)) || 0;
}
