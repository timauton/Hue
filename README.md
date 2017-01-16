# Hue
Phillips Hue module for the ZWay home automation system

This is a modificaiton of Minux's original module.

Original discussion thread here: https://forum.z-wave.me/viewtopic.php?f=3419&t=24012

Tested with Color and Ambience lights. Dimmable white lights should also work,
but are currently untested.

On/Off devices and scenes currently do not work and there is no support for sensors.
Adding sensors would be hard and not very practical, as the Hue hub cannot push events
and the Hue bridge's API rate limits mean polling frequently is not a great idea.
