import { Component, Input, Output, EventEmitter, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { GoogleAnalyticsService } from 'src/app/services/google-analytics.service';
import { Observable, Subscription } from 'rxjs';
import { AccountInfoChanged, GenericBackendPostRequest } from 'src/app/utils/types';
import { XummPostPayloadBodyJson } from 'xumm-api';
import { LocalStorageService } from 'angular-2-local-storage';

@Component({
  selector: 'rawTransactions',
  templateUrl: './rawTransactions.html'
})
export class RawTransactionsComponent implements OnInit, OnDestroy {
  constructor(private localStorage: LocalStorageService, private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;
  
  @Output()
  onPayload: EventEmitter<GenericBackendPostRequest> = new EventEmitter();

  @ViewChild('inprawjsontransaction', {static: false}) inprawjsontransaction;
  rawJsonTransaction: string = "{}";

  isValidJson:boolean = false;
  errorMsg:string;
  
  private darkModeChangedSubscription: Subscription;

  editorOptions = {
    tabSize: 2,
    mode: 'application/json',
    theme: 'material-darker',
    lineNumbers: true,
    line: true
  };

  ngOnInit() {
    if(this.localStorage.get("darkMode"))
      this.editorOptions.theme = "material-darker";
    else
      this.editorOptions.theme = "default";

      this.darkModeChangedSubscription = this.localStorage.setItems$.subscribe(value => {
        //console.log(JSON.stringify(value));

        if(value.key === "darkMode") {
          if(value.newvalue === "true")
            this.editorOptions = Object.assign({}, this.editorOptions, { theme: 'material-darker' });
          else
            this.editorOptions = Object.assign({}, this.editorOptions, { theme: 'default' });
        }
      })
  }

  ngOnDestroy() {
    if(this.darkModeChangedSubscription != null)
      this.darkModeChangedSubscription.unsubscribe();
  }

  checkJson() {
    try {
      let json:any = JSON.parse(this.rawJsonTransaction);
      if(json.TransactionType)
        this.isValidJson = true;
      else {
        this.isValidJson = false;
        this.errorMsg = "Field 'TransactionType' required";
      }
    } catch(err) {
      this.isValidJson = false;
      this.errorMsg = "Invalid JSON format";
    }
  }

  sendToXumm() {
    this.googleAnalytics.analyticsEventEmitter('raw_transaction', 'sendToXumm', 'raw_transaction_component');

    let payload:XummPostPayloadBodyJson = {
      txjson: JSON.parse(this.rawJsonTransaction)
    }
    this.onPayload.next({options: {isRawTrx: true} ,payload: payload});
  }
}
