import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { AccountInfoChanged, GenericBackendPostRequest, XrplAccountChanged } from 'src/app/utils/types';
import { isValidXRPAddress } from 'src/app/utils/utils';
import { ActivatedRoute } from '@angular/router';
import { MatExpansionPanel } from '@angular/material/expansion';

@Component({
  selector: 'transactionScheduler',
  templateUrl: './transactionScheduler.html'
})
export class TransactionSchedulerComponent {
  
  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;
  
  @Output()
  onPayload: EventEmitter<GenericBackendPostRequest> = new EventEmitter();

  @ViewChild('trxs', {static: true}) trxs: MatExpansionPanel;

  originalAccountInfo:any = null;
  originalTestModeValue:boolean = false;
  isTestMode:boolean = false;

  accountNotFound:boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  escrowAccountChanged: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();

  constructor(private route: ActivatedRoute) {}
  
  ngOnInit() {

    this.route.queryParams.subscribe(async params => {
      let openEscrowReleaser = params.escrowReleaser;

      if(openEscrowReleaser && "open" == openEscrowReleaser) {
        this.trxs.open();
      }
    });

    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      console.log("account info changed received: " + JSON.stringify(accountData));
      if(accountData) {
        this.originalAccountInfo = accountData.info;
        this.isTestMode = accountData.mode;

        if(this.originalAccountInfo && this.originalAccountInfo.Account && isValidXRPAddress(this.originalAccountInfo.Account)) {
          this.escrowAccountChanged.next({account: this.originalAccountInfo.Account, mode: accountData.mode});
        }
      } else {
        this.originalAccountInfo = null;
      }
    });
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();
  }
  
}
