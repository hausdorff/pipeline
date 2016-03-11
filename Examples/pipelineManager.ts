import restify = require('restify');
import pipelineConfig = require ('./pipelineConfig');


import planStore = require('./planStore');
import countStore = require('./countStore');
import processorJavascript = require('./processJavascript');

export function confirmServersReady() : boolean {
    var ready = (planStore.ready && countStore.ready && processorJavascript.ready) ? true : false;
    console.log('Servers ready is ' + ready);
    return ready;    
}