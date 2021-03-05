import { Component, OnInit, Input, OnDestroy, ViewChild } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { GenericBackendPostRequest, TransactionValidation, XrplAccountChanged } from 'src/app/utils/types';
import { XRPLWebsocket } from '../../services/xrplWebSocket';
import * as normalizer from '../../utils/normalizers';
import { XummService } from '../../services/xumm.service';
import { MatDialog } from '@angular/material/dialog';
import { GenericPayloadQRDialog } from '../genericPayloadQRDialog';
import { XummSignDialogComponent } from '../xummSignRequestDialog';
import { isValidXRPAddress } from "src/app/utils/utils";
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatExpansionPanel } from "@angular/material/expansion";

@Component({
    selector: "escrowListExecuter",
    templateUrl: "escrowListExecuter.html",
    styleUrls: ['./escrowListExecuter.css']
})
export class EscrowListExecuter implements OnInit, OnDestroy {

    @Input()
    escrowAccountChanged: Observable<XrplAccountChanged>;
    
    escrowData:any[] = [];
    displayedColumns: string[] = ['destination', 'amount', 'finishafter', 'autorelease', 'expectedautorelease', 'action'];
    loading:boolean = false;
    isTestMode:boolean = false;

    checkBoxAcceptPayment:boolean = false;

    private escrowAccountChangedSubscription: Subscription;

    constructor(
        private xrplWebSocket: XRPLWebsocket,
        private xumm: XummService,
        private matDialog: MatDialog,
        private snackBar: MatSnackBar,
        private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.escrowAccountChangedSubscription = this.escrowAccountChanged.subscribe(accountData => {
            //console.log("escrow account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);
            if(accountData) {
                this.isTestMode = accountData.mode;
                this.loadEscrowList(accountData.account);
            }
            else
                this.escrowData = [];
        });
    }

    ngOnDestroy() {
        if(this.escrowAccountChangedSubscription)
          this.escrowAccountChangedSubscription.unsubscribe();
    }

    async loadEscrowList(xrplAccount: string) {
        if(xrplAccount) {
            this.loading = true;

            let account_objects_request:any = {
              command: "account_objects",
              account: xrplAccount,
              type: "escrow",
              ledger_index: "validated",
            }
      
            let message:any = await this.xrplWebSocket.getWebsocketMessage("escrowListExecuter", account_objects_request, this.isTestMode);
            
            if(message && message.status && message.status === 'success' && message.type && message.type === 'response') {
                if(message.result && message.result.account_objects) {
                   this.escrowData = message.result.account_objects.filter(escrow => escrow.FinishAfter && !escrow.Condition);

                    for(let i = 0; i < this.escrowData.length; i++) {
                        let sequence:number = await this.getEscrowSequence(this.escrowData[i]);
                        this.escrowData[i].sequence = sequence;    
                        this.escrowData[i].testnet = this.isTestMode;                   
                    }

                    //if data 0 (no available escrows) -> show message "no escrows available"
                    if(this.escrowData.length == 0)
                        this.escrowData = null;
                }
            } else {                
                this.escrowData = null;
            }

            console.log("escrowData: " + JSON.stringify(this.escrowData));

            let storedEscrowListResponse:any = await this.xumm.getStoredEscrowList(xrplAccount, this.isTestMode);
            console.log("storedEscrows: " + JSON.stringify(storedEscrowListResponse));
            

            if(this.escrowData && storedEscrowListResponse && storedEscrowListResponse.success && storedEscrowListResponse.escrows) {
                let storedEscrows:any[] = storedEscrowListResponse.escrows;

                for(let i = 0; i < this.escrowData.length; i++) {
                    for(let j = 0; j < storedEscrows.length; j++) {
                        if(this.escrowData[i].account = storedEscrows[j].account && this.escrowData[i].sequence == storedEscrows[j].sequence && this.escrowData[i].testnet == storedEscrows[j].testnet)
                            this.escrowData[i].autorelease = true;
                    }

                    if(!this.escrowData[i].autorelease)
                        this.escrowData[i].autorelease = false;
                }
            }
            this.googleAnalytics.analyticsEventEmitter('load_escrow_list_executer', 'escrow_list_executer', 'escrow_list_executer_component');

            this.loading = false;
        }
    }

    async getEscrowSequence(escrow: any): Promise<number> {
        let sequence:number = null;

        let txInfo:any = {
            command: "tx",
            transaction: escrow.PreviousTxnID,
        }

        let message:any = await this.xrplWebSocket.getWebsocketMessage("escrowListExecuter", txInfo, this.isTestMode);
        if(message && message.status && message.status === 'success' && message.type && message.type === 'response') {
            if(message.result && message.result.TransactionType === 'EscrowCreate') {
                //console.log("Sequence: " + message.result.Sequence);
                sequence = message.result.Sequence
            }
        }

        return Promise.resolve(sequence);

    }

    getTimeFromRippleTime(rippleCodedFinishAfter: number): string {
        if(rippleCodedFinishAfter) {
            let finishAfter:Date = new Date(normalizer.rippleEpocheTimeToUTC(rippleCodedFinishAfter));
            return finishAfter.toLocaleString();
        } else
            return "-";
    }

    getExpectedAutoReleaseTime(rippleCodedFinishAfter: number): string {
        if(rippleCodedFinishAfter) {
            let expectedRelease:Date = new Date(normalizer.rippleEpocheTimeToUTC(rippleCodedFinishAfter));
            expectedRelease.setHours(expectedRelease.getHours()+1);
            expectedRelease.setMinutes(5,0,0);
            return expectedRelease.toLocaleString();
        } else
            return "-";
    }

    getAmountInXRP(amount: string): Number {
        return Number.parseInt(amount) / 1000000;
    }

    enableAutoFinish(escrow: any) {
        console.log("Enable auto finish for: " + JSON.stringify(escrow));
        this.payForEscrowRelease(escrow);
    }

    disableAutoFinish(escrow: any) {
        console.log("Disable auto finish for: " + JSON.stringify(escrow));
        this.signInToDisableAutoRelease(escrow);
    }

    payForEscrowRelease(escrow: any) {
        let genericBackendRequest:GenericBackendPostRequest = {
            options: {
                xrplAccount: escrow.Account
            },
            payload: {
                txjson: {
                    TransactionType: "Payment",
                    Memos : [{Memo: {MemoType: Buffer.from("[https://xumm.community]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from("Payment for Auto Release of Escrow! Owner:" + escrow.Account + " Sequence: " + escrow.sequence, 'utf8').toString('hex').toUpperCase()}}]
                },
                custom_meta: {
                    instruction: "SIGN WITH ESCROW OWNER ACCOUNT!!!\n\nEnable Auto Release for Escrow!\n\nEscrow-Owner: " + escrow.Account + "\nSequence: " + escrow.sequence + "\nFinishAfter: " + new Date(normalizer.rippleEpocheTimeToUTC(escrow.FinishAfter)).toLocaleString() + "\n" + (this.isTestMode ? "\nMake sure you are connected to Testnet!" : ""),
                    blob: {account: escrow.Account, sequence: escrow.sequence, finishafter: normalizer.rippleEpocheTimeToUTC(escrow.FinishAfter), testnet: this.isTestMode}
                },
            }
        }
        
        const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
          width: 'auto',
          height: 'auto;',
          data: genericBackendRequest
        });
    
        dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
          //console.log('The generic dialog was closed: ' + JSON.stringify(info));
    
          if(info && info.success && info.account && info.account == escrow.Account && (info.testnet == this.isTestMode || (!info.testnet && this.isTestMode))) {
            //handle success
            this.snackBar.open("Transaction successfull! You have enabled the auto release feature for your escrow!", null, {panelClass: 'snackbar-success', duration: 10000, horizontalPosition: 'center', verticalPosition: 'top'});
             
            this.googleAnalytics.analyticsEventEmitter('pay_for_escrow_release', 'escrow_executer', 'escrow_executer_component');
          } else if( info && info.testnet && info.testnet != this.isTestMode) {
            this.snackBar.open("You have submitted a transaction on the " + (info.testnet ? "Testnet" : "Mainnet") + " for an escrow on the " + (this.isTestMode ? "Testnet": "Mainnet") + "! Can not activate Auto Release!", null, {panelClass: 'snackbar-failed', duration: 10000, horizontalPosition: 'center', verticalPosition: 'top'});
          } else if(info && info.account && info.account != escrow.Account) {
                this.snackBar.open("Your account from the payment does not match the Escrow owner account. Can not enable Auto Releasing!", null, {panelClass: 'snackbar-failed', duration: 10000, horizontalPosition: 'center', verticalPosition: 'top'});
          } else {
              if(info) {
                this.snackBar.open(info && info.message ? info.message : "An error occured handling your payment", null, {panelClass: 'snackbar-failed', duration: 10000, horizontalPosition: 'center', verticalPosition: 'top'});
              } else {
                  //user closed, nothing to do
              }
          }

          await this.loadEscrowList(escrow.Account);
        });
    }

    signInToDisableAutoRelease(escrow: any) {
    
        const dialogRef = this.matDialog.open(XummSignDialogComponent, {
          width: 'auto',
          height: 'auto;',
          data: {
              xrplAccount: escrow.Account,
              instruction: "Sign in with the account that created the Escrow to verify ownership!",
              blob: {account: escrow.Account, sequence: escrow.sequence, finishafter: normalizer.rippleEpocheTimeToUTC(escrow.FinishAfter), testnet: this.isTestMode}
            }
        });
    
        dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
          //console.log('The signin dialog was closed: ' + JSON.stringify(info));
          if(info && info.success && info.account && isValidXRPAddress(info.account) && info.account == escrow.Account) {
            //console.log(JSON.stringify(disableResponse));

            this.snackBar.dismiss();
            if(info.success) {
                this.snackBar.open("Ownership verified and auto release disabled!", null, {panelClass: 'snackbar-success', duration: 7500, horizontalPosition: 'center', verticalPosition: 'top'});
            } else {
                this.snackBar.open("Ownership verified but error disabling auto release!", null, {panelClass: 'snackbar-success', duration: 7500, horizontalPosition: 'center', verticalPosition: 'top'});
            }
          } else {
            this.snackBar.open("Could not verify ownership. You are not allowed to disable the auto release for this escrow!", null, {panelClass: 'snackbar-failed', duration: 7500, horizontalPosition: 'center', verticalPosition: 'top'});
          }

          await this.loadEscrowList(escrow.Account);
        });
    }
}