import { Component, Input, Output, EventEmitter, ViewChild, OnInit, OnDestroy } from '@angular/core';
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
  constructor(private utilService: UtilService, private localStorage: LocalStorageService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;
  
  @Output()
  onPayload: EventEmitter<GenericBackendPostRequest> = new EventEmitter();

  @ViewChild('inprawjsontransaction') inprawjsontransaction;
  rawJsonTransaction: string = "{}";

  @ViewChild('mep', {static: true}) mep: MatExpansionPanel;

  originalAccountInfo:any = null;
  isTestMode:boolean = false;
  isValidJson:boolean = false;
  errorMsg:string;
  
  private accountInfoChangedSubscription: Subscription;
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

    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(async accountData => {
      //console.log("account info changed received: " + JSON.stringify(accountData));
      if(accountData) {
        this.originalAccountInfo = accountData.info;
      } else {
        this.originalAccountInfo = null;
      }

      this.isTestMode = accountData.mode;
      await this.loadTransactionTemplates();

    });

    this.darkModeChangedSubscription = this.localStorage.setItems$.subscribe(value => {
      //console.log(JSON.stringify(value));

      if(value.key === "darkMode") {
        if(value.newvalue === "true")
          this.editorOptions = Object.assign({}, this.editorOptions, { theme: 'material-darker' });
        else
          this.editorOptions = Object.assign({}, this.editorOptions, { theme: 'default' });
      }
    });

    this.loadTransactionTemplates();
  }

  async loadTransactionTemplates() {
    this.loadingTemplates = true;

    this.transactionTemplates = await this.utilService.getTransactionTypes(this.isTestMode ? 21338 : 21337 ,this.originalAccountInfo && this.originalAccountInfo.Account ? this.originalAccountInfo.Account : null);

    for(let i = 0; i < this.transactionTemplates.length; i++) {
      delete this.transactionTemplates[i].codeSamples[0].Sequence;
      delete this.transactionTemplates[i].codeSamples[0].Fee;
    }

    this.transactionTemplates = [{transactionType: "None", docLink: null, requiresAmendment: false, codeSamples: [{}]}].concat(this.transactionTemplates.filter(template => template.codeSamples[0].TransactionType != 'AccountDelete'));

    this.loadingTemplates = false;
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

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
    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: JSON.parse(this.rawJsonTransaction),
      options: {
        
      }
    }
    this.onPayload.next({options: {testnet: this.isTestMode, isRawTrx: true}, payload: payload});
  }

  changeTemplate() {
    //console.log("Selected template: " + JSON.stringify(this.selectedTemplate));
    this.rawJsonTransaction = JSON.stringify(this.selectedTemplate.codeSamples[0], null, '  ');
    this.checkJson();
  }
}
