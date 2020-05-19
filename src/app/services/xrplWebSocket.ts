import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Injectable, Optional, SkipSelf } from '@angular/core';

@Injectable()
export class XRPLWebsocket {
    
    originalTestModeValue:boolean = false;
    liveNodes:string[] = ['wss://xrpl.ws', 'wss://s2.ripple.com'];
    testNodes:string[] = ['wss://testnet.xrpl-labs.com', 'wss://s.altnet.rippletest.net'];
    liveFirst:boolean = true;
    testFirst:boolean = true;

    websocketMap:Map<string, any> = new Map();

    constructor (@Optional() @SkipSelf() parentModule?: XRPLWebsocket) {
        if (parentModule) {
          throw new Error(
            'XRPLWebsocket is already loaded. Import it in the AppModule only');
        }
    }

    getWebsocketMessage(command:any, newTestMode:boolean, retry?:boolean): Promise<any> {

        if(this.websocketMap.get(command.command) && this.websocketMap.get(command.command).mode != newTestMode) {
            //console.log("test mode changed")
            this.websocketMap.get(command.command).socket.unsubscribe();
            this.websocketMap.get(command.command).socket.complete();
            this.websocketMap.delete(command.command)

            console.log("websockets: " + this.websocketMap.size);
        }

        if(!this.websocketMap.get(command.command) || this.websocketMap.get(command.command).socket.closed) {

            this.originalTestModeValue = newTestMode;
            console.log("connecting websocket with testmode: " + this.originalTestModeValue);
            let newWebsocket = webSocket(this.originalTestModeValue ? (this.testFirst ? this.testNodes[0] : this.testNodes[1]) : (this.liveFirst ? this.liveNodes[0] : this.liveNodes[1]));

            this.websocketMap.set(command.command, {socket: newWebsocket, mode: newTestMode});

            console.log("websockets: " + this.websocketMap.size);
        }

        return new Promise((resolve, reject) => {
            this.websocketMap.get(command.command).socket.asObservable().subscribe(async message => {
                resolve(message);
            }, async error => {
                this.websocketMap.get(command.command).socket.complete();
                this.websocketMap.delete(command.command)
                
                if(!retry) {
                    console.log("could not connect websocket! changing node!");
                    resolve(await this.connectToSecondWS(command));
                } else {
                    resolve({error: true, message: "No node connection possible"});
                }
            });

            console.log("setting up command: " + JSON.stringify(command))
            this.websocketMap.get(command.command).socket.next(command);
        });        
    }

    connectToSecondWS(command): Promise<any> {
        if(this.originalTestModeValue)
            this.testFirst = !this.testFirst;
        else
            this.liveFirst = !this.liveFirst;

        return this.getWebsocketMessage(command, this.originalTestModeValue, true);
    }
}

