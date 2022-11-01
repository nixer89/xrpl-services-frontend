import { Component, Input, Output, EventEmitter, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { GoogleAnalyticsService } from 'src/app/services/google-analytics.service';
import { Observable, Subscription } from 'rxjs';
import { AccountInfoChanged, GenericBackendPostRequest, TransactionTemplate } from 'src/app/utils/types';
import { XummTypes } from 'xumm-sdk';
import { LocalStorageService } from 'angular-2-local-storage';
import { UtilService } from '../../services/util.service';
import { MatExpansionPanel } from '@angular/material/expansion';

@Component({
  selector: 'rawTransactions',
  templateUrl: './rawTransactions.html'
})
export class RawTransactionsComponent implements OnInit, OnDestroy {
  constructor(private utilService: UtilService, private localStorage: LocalStorageService, private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;
  
  @Output()
  onPayload: EventEmitter<GenericBackendPostRequest> = new EventEmitter();

  @ViewChild('inprawjsontransaction') inprawjsontransaction;
  rawJsonTransaction: string = "{}";

  @ViewChild('mep', {static: true}) mep: MatExpansionPanel;

  private accountInfoChangedSubscription: Subscription;
  originalAccountInfo:any;

  isValidJson:boolean = false;
  errorMsg:string;

  nodeUrl:string;
  
  private darkModeChangedSubscription: Subscription;

  editorOptions = {
    tabSize: 2,
    mode: 'application/json',
    theme: 'material-darker',
    lineNumbers: true,
    line: true
  };

  transactionTemplates:TransactionTemplate[];
  selectedTemplate:TransactionTemplate;
  loadingTemplates:boolean = false;


  async ngOnInit() {
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
    });

    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received: " + JSON.stringify(accountData));
      this.originalAccountInfo = accountData.info;
      this.nodeUrl = accountData.nodeUrl;
    });

    this.loadingTemplates = true;

    this.transactionTemplates = await this.utilService.getTransactionTypes();

    for(let i = 0; i < this.transactionTemplates.length; i++) {
      delete this.transactionTemplates[i].codeSamples[0].Sequence;
      delete this.transactionTemplates[i].codeSamples[0].Fee;
    }

    this.transactionTemplates = [{transactionType: "None", docLink: null, requiresAmendment: false, codeSamples: [{}]}].concat(this.transactionTemplates)

    this.loadingTemplates = false;
  }

  ngOnDestroy() {
    if(this.darkModeChangedSubscription != null)
      this.darkModeChangedSubscription.unsubscribe();
    
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();
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

    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: JSON.parse(this.rawJsonTransaction)
    }
    this.onPayload.next({options: {isRawTrx: true} ,payload: payload});
  }

  changeTemplate() {
    //console.log("Selected template: " + JSON.stringify(this.selectedTemplate));
    this.rawJsonTransaction = JSON.stringify(this.selectedTemplate.codeSamples[0], null, '  ');
    this.checkJson();
  }
}
