import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Injectable, Optional, SkipSelf } from '@angular/core';

@Injectable()
export class XRPLWebsocket {
    
    originalNodeUrl:string = "";
    errorsToSwitch:string[] = ["amendmentBlocked", "failedToForward", "invalid_API_version", "noClosed", "noCurrent", "noNetwork", "tooBusy"]

    websocketMap:Map<string, any> = new Map();

    constructor (@Optional() @SkipSelf() parentModule?: XRPLWebsocket) {
        if (parentModule) {
          throw new Error(
            'XRPLWebsocket is already loaded. Import it in the AppModule only');
        }
    }

    async getWebsocketMessage(componentname:string, command:any, nodeUrl:string, retry?:boolean): Promise<any> {

        if(this.websocketMap.get(componentname) && this.websocketMap.get(componentname).nodeUrl != nodeUrl) {
            //console.log("test mode changed")
            this.websocketMap.get(componentname).socket.unsubscribe();
            this.websocketMap.get(componentname).socket.complete();
            this.websocketMap.delete(componentname)

            //console.log("websockets: " + this.websocketMap.size);
        }

        if(!this.websocketMap.get(componentname) || this.websocketMap.get(componentname).socket.closed) {

            this.originalNodeUrl = nodeUrl;
            console.log("connecting to websocket: " + this.originalNodeUrl);
            let newWebsocket = webSocket(this.originalNodeUrl);

            this.websocketMap.set(componentname, {socket: newWebsocket, nodeUrl: nodeUrl, isBusy: false});

            //console.log("websockets: " + this.websocketMap.size);
        }

        return new Promise((resolve, reject) => {
            this.websocketMap.get(componentname).socket.asObservable().subscribe(async message => {
                //console.log(JSON.stringify(message));
                
                if(message && message.error && this.errorsToSwitch.includes(message.error)) {
                    resolve(await this.cleanupAndChangeNode(componentname, command, retry));    
                } else {
                    resolve(message);
                }               
            }, async error => {
                resolve(await this.cleanupAndChangeNode(componentname, command, retry));
            });

            //console.log("setting up command: " + JSON.stringify(command))
            this.websocketMap.get(componentname).socket.next(command);
        });        
    }

    async cleanupAndChangeNode(componentname: string, command: any, retry: boolean): Promise<any> {
        this.websocketMap.get(componentname).socket.complete();
        this.websocketMap.delete(componentname)
        
        if(!retry) {
            console.log("could not connect websocket! changing node!");
            return this.connectToSecondWS(componentname, command);
        } else {
            return {error: true, message: "No node connection possible"};
        }
    }

    async connectToSecondWS(componentname:string, command:any): Promise<any> {
        return this.getWebsocketMessage(componentname, command, this.originalNodeUrl, true);
    }
}

