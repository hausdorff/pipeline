import restify = require('restify');
import pipelineConfig = require ('./pipelineConfig');

var log = require('winston');
log.level = 'error';


import planStore = require('./planStore');
import countStore = require('./countStore');
import processorJavascript = require('./processJavascript');

export function confirmServersReady() : boolean {
    var ready = (planStore.ready && countStore.ready && processorJavascript.ready) ? true : false;
    log.info('Pipeline ready = ' + ready);
    return ready;
}