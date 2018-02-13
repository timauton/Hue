/** Hue Z-Way HA module *******************************************

Version: 1.0
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
    
    if (!this.config.key || this.config.key == 0) {
    	this.getKey(self);
    } else {
    	this.authenticate(self);
    }
    
    this.timer = setInterval(function() {
		self.refreshAllHueLights(self);
    }, 15000 * 1000);
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

Hue.prototype.getKey = function(self) {
	console.log("Hue getKey started");
	
	http.request({
        url: "http://" + self.config.ip + "/api",
        method: "POST",
        headers: { "Content-type": "application/json;charset=UTF-8" },
        data: JSON.stringify({"devicetype":"SmartHome#RasberryPiZway"}),
        async: true,
        success: function(rsp) {
        	if (rsp.data[0].success) {
				console.log("Hue Get Key OK : " + rsp.data[0].success.username);
				self.config.key = rsp.data[0].success.username;
				self.authenticate(self);
			} else {
				console.log("Failed to get Hue Key, error description : " + rsp.data[0].error.description);
				console.log("Did you press the button? Try going into the module settings, entering 0 for the key, pressing the Hue button and saving again");
			}
        },
        error: function(rsp) {
            console.log("Hue Get Key Error! : " +  + JSON.stringify(rsp));
        },
        complete: function(rsp) {
            console.log("Hue Get Key Complete!");
        }
    });
	
}

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
            console.log("Hue Connection Authenticate OK -> " + JSON.stringify(rsp));
            self.createDevices(self, rsp.data);
        },
        error: function(rsp) {
            console.log("Hue Erreur Connection Authenticate: " + url);
        },
        complete: function(rsp) {
            console.log("Hue Finished Auth: " + url);
        }
    });
};


Hue.prototype.createDevices = function(self, jsonData) {
    console.log("Hue Create Devices");
    var moduleName = "Hue";
    var deviceLights = jsonData.lights;
    var deviceGroups = jsonData.groups;
    
    // build a map of lights to rooms
    var lightLocations = [];
    for (var group in deviceGroups) {
    	var locId = 0;
    	for (var loc in self.controller.locations) {
    		if (self.controller.locations[loc].title == deviceGroups[group].name) {
    			locId = self.controller.locations[loc].id;
    		}
    	}
    	for (var lightId in deviceGroups[group].lights) {
    		console.log("Hue : Light " + deviceGroups[group].lights[lightId] + " is in location " + locId);
    		lightLocations[deviceGroups[group].lights[lightId]] = locId;
    	}
    }
    
    // add the lights
    for (var lightId in deviceLights) {
        var on = deviceLights[lightId].state.on;
        var bri = (on) ? self.fromBriSatVal(deviceLights[lightId].state.bri) : 0;
        var ct = self.fromCtVal(deviceLights[lightId].state.ct);
        var sat = self.fromBriSatVal(deviceLights[lightId].state.sat);
        var hue = self.fromHueVal(deviceLights[lightId].state.hue);
        var name = deviceLights[lightId].name;
        var uniqueid = deviceLights[lightId].uniqueid;
		var reachable = deviceLights[lightId].state.reachable;
		var loc = lightLocations[lightId];
        
        switch (deviceLights[lightId].type) {
        	case  "Color temperature light":
				self.createHueMultilevelDevice("lights", lightId, name, uniqueid, reachable, "bri", bri, loc);
				self.createHueMultilevelDevice("lights", lightId, name + " Color Temperature", uniqueid, reachable, "ct", ct, loc);
				break;
			case "Extended color light":
				self.createHueMultilevelDevice("lights", lightId, name, uniqueid, reachable, "bri", bri, loc);
				self.createHueMultilevelDevice("lights", lightId, name + " Color Temperature", uniqueid, reachable, "ct", ct, loc);
				if (self.config.createHueSat) {
					self.createHueMultilevelDevice("lights", lightId, name + " Hue", uniqueid, reachable, "hue", hue, loc);
					self.createHueMultilevelDevice("lights", lightId, name + " Saturation", uniqueid, reachable, "sat", sat, loc);
				}
				if (self.config.createXY) {
					self.createHueColorDevice("lights", lightId, name + " Color", uniqueid, reachable, "col", loc);
				}
				break;
			case "Color light":
				self.createHueMultilevelDevice("lights", lightId, name, uniqueid, reachable, "bri", bri, loc);
				if (self.config.createHueSat) {
					self.createHueMultilevelDevice("lights", lightId, name + " Hue", uniqueid, reachable, "hue", hue, loc);
					self.createHueMultilevelDevice("lights", lightId, name + " Saturation", uniqueid, reachable, "sat", sat, loc);
				}
				if (self.config.createXY) {
					self.createHueColorDevice("lights", lightId, name + " Color", uniqueid, reachable, "col", loc);
				}
				break;
			case "Dimmable light":
				self.createHueMultilevelDevice("lights", lightId, name, uniqueid, reachable, "bri", bri, loc);
				break;
			case "On/Off light":
				// TODO: write createHueOnOffDevice
				break;
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

Hue.prototype.createHueMultilevelDevice = function(type, number, name, uniqueid, reachable, subType, level, loc) {

    var self = this;
	
    console.log("Hue createHueMultilevelDevice (" + type + number + subType + ")-> Reachable(" + reachable + ") HueLevel(" + level + ")");
    
    var deviceId = "Hue_" + uniqueid + "_" + type + "_" + number + "_" + subType;
    
    switch (subType) {
    	case "hue":
    	case "sat":
    		var iconPath = "/ZAutomation/api/v1/load/modulemedia/Hue/bulbc.jpg";
    		break;
    	case "ct":
    		var iconPath = "/ZAutomation/api/v1/load/modulemedia/Hue/bulbc.png";
    		break;
    	default:
    		var iconPath = "/ZAutomation/api/v1/load/modulemedia/Hue/whitebulb.png"
    		break;
    }

    var vDev = self.controller.devices.create({
        deviceId: deviceId,
        defaults: {
            deviceType: "switchMultilevel",
            metrics: {
                title: name,
                icon: iconPath,
                level: level,
                type: type,
                number: number,
                subType: subType,
                reachable: reachable,
                change: ''
            }
        },
        overlay: {},
        handler: function(command, args) {
        	console.log("Hue vDev handler called : " + JSON.stringify(args));
            if (command === "on") self.sendAction(self, deviceId, "state", { "on": true, "transitiontime": self.config.transitionTime });
            if (command === "off") self.sendAction(self, deviceId, "state", { "on": false, "transitiontime": self.config.transitionTime });
            if (command === "exact") {
                var currentDevice = self.controller.devices.get(deviceId);
                var subType = currentDevice.get("metrics:subType");
                var dontSendOn = (self.config.dontSendOn && currentDevice.get("metrics:level") != 0);
                var jsonCmd;
                
                console.log("subType is : " + subType);
                
                switch (subType) {
                	case "bri":
						if (args.level == 0) {
							jsonCmd = { "on": false, "transitiontime": self.config.transitionTime };
						} else {
							if (dontSendOn) {
								jsonCmd = { "bri": self.toBriSatVal(args.level), "transitiontime": self.config.transitionTime };
							} else {
								jsonCmd = { "on": true, "bri": self.toBriSatVal(args.level), "transitiontime": self.config.transitionTime };
							}
						}
						break;
					case "ct":
						jsonCmd = { "ct": self.toCtVal(args.level), "transitiontime": self.config.transitionTime };
						break;
					case "sat":
						jsonCmd = { "sat": self.toBriSatVal(args.level), "transitiontime": self.config.transitionTime };
						break;
					case "hue":
						jsonCmd = { "hue": self.toHueVal(args.level), "transitiontime": self.config.transitionTime };
						break;
				}
				if (jsonCmd) {
					self.sendAction(self, deviceId, "state", jsonCmd);
				}
            }
        },
        moduleId: this.id
    });
    if (self.config.homebridgeSkip) {
		vDev.addTag("Homebridge.Skip");
	}
	vDev.set("location",loc);
	vDev.addTag("HUE");

};

Hue.prototype.createHueColorDevice = function(type, number, name, uniqueid, reachable, subType, loc ) {

    var self = this;
    
    // var hueLevel = (reachable == true) ? ((state == true) ? "on" : "off") : null;
    
    var deviceId = "Hue_" + uniqueid + "_" + type + "_" + number + "_" + subType;

    console.log("Hue createHueColorDevice (" + type + number + ")");

    var vDev = self.controller.devices.create({
        deviceId: deviceId,
        defaults: {
            deviceType: "switchRGBW",
            probeType: "switchColor_rgb",
            metrics: {
                title: name,
                icon: "/ZAutomation/api/v1/load/modulemedia/Hue/bulb.jpg",
                level: "off",
                color: { r: 255, g: 255, b: 255 },
                type: type,
                number: number,
                subType: subType,
                reachable: reachable,
                change: ''
            }
        },
        overlay: {},
        handler: function(command, args) {
            //console.log("Hue Color Handler " + name + "(" + type + id + ")-> Command(" + command + ") Args(" + args + ")");
            if (command === "on") self.sendAction(self, deviceId, "state", { "on": true, "transitiontime": self.config.transitionTime });
            if (command === "off") self.sendAction(self, deviceId, "state", { "on": false, "transitiontime": self.config.transitionTime });
            if (command === "exact") {
            	var currentDevice = self.controller.devices.get(deviceId);
                var dontSendOn = (self.config.dontSendOn && currentDevice.get("metrics:level") == "on");
                
                var xy = self.toXY(args.red, args.green, args.blue);
                if (dontSendOn) {
                	self.sendAction(self, deviceId, "state", { "xy": xy, "transitiontime": self.config.transitionTime });
                } else {
                	self.sendAction(self, deviceId, "state", { "on": true, "xy": xy, "transitiontime": self.config.transitionTime });
                }
            }
            // TODO - make this update from the response
            self.controller.devices.get(deviceId).set("metrics:color",{"r":parseInt(args.red),"g":parseInt(args.green),"b":parseInt(args.blue)});
        },
        moduleId: this.id
    });
    if (self.config.homebridgeSkip) {
		vDev.addTag("Homebridge.Skip");
	}
	vDev.set("location",loc);
	vDev.addTag("HUE");
};

Hue.prototype.createGroupSceneDevice = function(type, grpId, grpName, sceneId, sceneName, lights) {

    var self = this;

    console.log("Hue CreateGroupSceneDevice " + grpName + "(" + type + grpId + ")-> sceneId(" + sceneName + " " + sceneId + ")");

	var deviceId = "Hue_" + this.id + "_" + type + "_" + grpId + "_" + sceneId;

    var vDev = self.controller.devices.create({
        deviceId: deviceId,
        defaults: {
            deviceType: "toggleButton",
            metrics: {
                title: grpName + " " + sceneName,
                icon: "",
                level: "off",
                lights: lights,
                type: "groups",
                number: grpId,
                subType: "scene"
            }
        },
        overlay: {},
        handler: function(command, args) {
            if (command === "on") self.sendAction(self, deviceId, "action", { "scene": sceneId });
        },
        moduleId: this.id
    });
};

Hue.prototype.sendAction = function(self, deviceId, command, action) {

	var currentDevice = self.controller.devices.get(deviceId);
    var url
		= "http://" + self.config.ip
		+ "/api/" + self.config.key
		+ "/" + currentDevice.get("metrics:type")
		+ "/" + currentDevice.get("metrics:number")
		+ "/" + command;
    var thisKey
		= "/" + currentDevice.get("metrics:type")
		+ "/" + currentDevice.get("metrics:number")
		+ "/" + command;
	var subType = currentDevice.get("metrics:subType");

    console.log("PhilipsHue Http sendAction-> " + url + " Action:" + JSON.stringify(action));

	//wait loop because hue gateway can be too slow sometimes
	var waitUntil = new Date().getTime() + 0.1*1000;
    while(new Date().getTime() < waitUntil) true;
    
    http.request({
        url: url,
        method: "PUT",
        headers: { "Content-type": "application/json;charset=UTF-8" },
        data: JSON.stringify(action),
        async: true,
        success: function(rsp) {
            console.log("PhilipsHue Send Action Success:" + JSON.stringify(rsp.data));
            for (var dat in rsp.data) {
            	var values = rsp.data[dat];
				if (values.success) {
					for (var key in values.success) {
						switch (key) {
							case thisKey + "/on":
								if (subType == "col" || subType == "onOff") {
									currentDevice.set("metrics:level", (values.success[key] == true) ? "on" : "off");
								}
								if (subType == "bri" && values.success[key] == false) {
									currentDevice.set("metrics:level",0);
								}
								break;
							case thisKey + "/hue":
								currentDevice.set("metrics:level",self.fromHueVal(values.success[key]));
								break;
							case thisKey + "/bri":
								currentDevice.set("metrics:level",self.fromBriSatVal(values.success[key]));
								break;
							case thisKey + "/sat":
								currentDevice.set("metrics:level",self.fromBriSatVal(values.success[key]));
								break;
							case thisKey + "/ct":
								currentDevice.set("metrics:level",self.fromCtVal(values.success[key]));
								break;
							case thisKey + "/xy":
								// perform command execute le handler de create device (!! boucle infini !!) i lfaut utuliser set.
								//device.performCommand('exact', { red: 255, green: 255, blue: 255 });
								break;
							case thisKey + "/scene":
								self.refreshAllHueLights(self);
								break;
						}
					}
				} else {
					self.controller.addNotification("error", "Hue " + JSON.stringify(values), "connection", "Hue");
				}
			}
        },
        error: function(rsp) {
            console.log("PhilipsHue Send Action Error : " + JSON.stringify(action));
            self.controller.addNotification("error", "Hue Send Action Error", "connection", "Hue");
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
        	//console.log(JSON.stringify(rsp));
        	for (var lightId in rsp.data) {
        					
				var filterId = "_lights_" + lightId;
				
				//console.log("Hue filterId is " + filterId);
				
				filterArray = self.controller.devices.filter(function(device) {
					return device.id.indexOf(filterId) > -1;
				});

				filterArray.forEach(function(device) {
					//console.log("Hue refreshing " + device.id);
					self.refreshHueLight(self, device, lightId, rsp);
				});
			}
        },
        error: function(rsp) {
            console.log("Phillisp Hue Error Refresh Hue: " + url);
        }
    });

};

Hue.prototype.refreshHueLight = function(self,device,lightId,rsp) {

    var res = device.id.split("_");
	var subType = (res.length>4) ? res[4] : null;
    var reachable = rsp.data[lightId].state.reachable;
	var newLevel;
	
	switch (subType) {
		case "hue":
			newLevel = self.fromHueVal(rsp.data[lightId].state.hue);
			break;
		case "bri":
			newLevel = self.fromBriSatVal(rsp.data[lightId].state.bri);
			if (!rsp.data[lightId].state.on) {
				newLevel = 0;
			} else if (newLevel == 0) {
				// low values can be rounded down to zero, but we don't want that
				newLevel = 1;
			}
			break;
		case "sat":
			newLevel = self.fromBriSatVal(rsp.data[lightId].state.sat);
			break;
		case "ct":
			newLevel = self.fromCtVal(rsp.data[lightId].state.ct);
			break;
		// TODO: read back X,Y values for RGB bulbs
		default:
			newLevel = ((rsp.data[lightId].state.on) ? "on" : "off");
			break;
	}
	
	if (device.get("metrics:level") != newLevel) {
		device.set("metrics:level",newLevel);
	}
	if (device.get("metrics:reachable") != reachable) {
		device.set("metrics:reachable", reachable);
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

Hue.prototype.fromXY = function(x,y) {

	/*
	var Z = 1;

	var r =  x * 1.656492f - y * 0.354851f - Z * 0.255038f;
	var g = -x * 0.707196f + y * 1.655397f + Z * 0.036152f;
	var b =  x * 0.051713f - y * 0.121364f + Z * 1.011530f;
	
	return { "r" : r, "g" : g, "b" : b };
	*/
}

Hue.prototype.toBriSatVal = function(value) {
    return Math.round((value * 254) / 99) || 0;
}

Hue.prototype.fromBriSatVal = function(value) {
	return Math.round((value * 99) / 254) || 0;
}

Hue.prototype.toHueVal = function(value) {
	return Math.round((value * 65535) / 99) || 0;
}

Hue.prototype.fromHueVal = function(value) {
	return Math.round((value * 99) / 65535) || 0;
}

Hue.prototype.toCtVal = function(value) {
	return Math.round(500 - (value/99*347)) || 0;
}

Hue.prototype.fromCtVal = function(value) {
	return Math.round((500-value)/347*99) || 0;
}
