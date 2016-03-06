import restify = require('restify');
import pipelineConfig = require ('./pipelineConfig');


import planStore = require('./planStore');
import countStore = require('./countStore');
import processorJavascript = require('./processJavascript');

export function confirmServersReady() : boolean {
    var ready = (planStore.pipelineServer && countStore.pipelineServer && processorJavascript.pipelineServer) ? true : false;
    console.log('Servers ready is ' + ready);
    return ready;    
}