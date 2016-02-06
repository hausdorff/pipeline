
import restify = require("restify");

export class PipelineELementClient 
{
    public port : number;
    public hostname : string;
    
    public get address() : string { return this.host; };
    public get host() : string { return this.hostname + ':' + this.port; };
    
    public client : restify.Client = null;
        
    constructor (hostname : string, port : number) 
    {
      this.hostname = hostname; 
      this.port = port;
      this.client = restify.createJsonClient({url : this.address });          
    }
    
}

export var initialPublic = new PipelineELementClient("http://localhost", 8080 );
export var initialPipeline = new PipelineELementClient("http://localhost", 8085 );
export var planStore = new PipelineELementClient( "http://localhost" , 8086 );
export var countStore = new PipelineELementClient(  "http://localhost", 8087);
export var processJavascript = new PipelineELementClient( "http://localhost", 8088);

