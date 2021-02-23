import { Component, OnInit, ViewChild } from '@angular/core';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AppService } from '../../services/app.service';
import { Token, TokenIssuer } from '../../utils/types'
import * as normalizer from 'src/app/utils/normalizers';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { DeviceDetectorService } from 'ngx-device-detector';

@Component({
  selector: 'issuedTokenList',
  templateUrl: './issuedTokenList.html',
  styleUrls: ['./issuedTokenList.css']
})
export class IssuedTokenList implements OnInit {

  constructor(
    private app: AppService,
    private deviceDetector: DeviceDetectorService,
    private googleAnalytics: GoogleAnalyticsService) {}

  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  @ViewChild(MatSort, {static: true}) sort: MatSort;


  displayedColumns: string[] = ['account', 'username', 'currency', 'amount', 'trustlines', "link"];
  datasource:MatTableDataSource<TokenIssuer> = null;

  loading:boolean = false;

  pageSize:number = 25;
  filterText:string = "";
  
  ledgerIndex: string;
  ledgerHash: string;
  ledgerCloseTime: number;
  issuingAccounts: number = 0;

  async ngOnInit() {
    this.pageSize = this.deviceDetector.isMobile() ? 5 : this.pageSize;
    this.loading = true;
    let issuers:TokenIssuer[] = await this.loadLedgerData();
    this.loading = false;
  
    this.datasource = new MatTableDataSource(issuers);

    if(issuers != null) {
      this.datasource.paginator = this.paginator;
      this.datasource.sort = this.sort;

      this.datasource.sortingDataAccessor = (data: any, sortHeaderId: string): string => {
        if (typeof data[sortHeaderId] === 'string') {
          if(!data[sortHeaderId] || data[sortHeaderId].trim().length == 0) {
            if(this.sort.direction === 'asc')
              return "zzzzzzzzzzzzzzzzzzzzzzzzz"
            else
              return "0000000000000000000000000"
          }
          else
            return data[sortHeaderId].toLocaleLowerCase();
        }
      
        return data[sortHeaderId];
      };

      this.datasource.filterPredicate = (data: TokenIssuer, filter: string) => {
        if(filter)
          filter = filter.trim().toLowerCase()

        return data.account && data.account.toLowerCase().includes(filter)
                || data.amount && data.amount.toString().toLowerCase().includes(filter)
                  || data.currency && data.currency.toLowerCase().includes(filter)
                    || data.trustlines && data.trustlines.toString().toLowerCase().includes(filter)
                      || (data.username && data.username.toLowerCase().includes(filter));
      };
    }
  }

  async loadLedgerData(): Promise<TokenIssuer[]> {
    let tokenIssuers:TokenIssuer[] = [];
    try {
      let issuedTokensResponse:any = await this.app.get('https://tokens.xumm.community/tokens');

      this.ledgerIndex = issuedTokensResponse.ledger_index;
      this.ledgerHash = issuedTokensResponse.ledger_hash;
      this.ledgerCloseTime = issuedTokensResponse.ledger_close_ms;
      this.issuingAccounts = 0;

      let issuers:any = issuedTokensResponse.tokens;

      for (var account in issuers) {
        if (issuers.hasOwnProperty(account)) {
            let issuedCurrencies:Token[] = issuers[account].tokens;
            let username:string = issuers[account].username;
            let resolvedBy:string = null;
            if(username && username.trim().length > 0) {
              if(username.endsWith("_[Bithomp]")) {
                username = username.replace("_[Bithomp]", "");
                resolvedBy = "Bithomp";
              } else if(username.endsWith("_[XRPScan]")) {
                username = username.replace("_[XRPScan]", "");
                resolvedBy = "XRPScan";
              }
            } else {
              username = "";
            }
            this.issuingAccounts++;
            issuedCurrencies.forEach(issuedCurrency => {
              tokenIssuers.push({account: account, currency: this.getCurrencyCode(issuedCurrency.currency), amount: issuedCurrency.amount, trustlines: issuedCurrency.trustlines, username: username, resolvedBy: resolvedBy});
            })
        }
      }
    } catch(err) {
      tokenIssuers = null
    }

    if(tokenIssuers && tokenIssuers.length == 0)
      tokenIssuers = null;

      console.log(tokenIssuers && tokenIssuers.length);
    return tokenIssuers;
  }

  stringToFloat(number: string): number {
    return parseFloat(number);
  }

  getCurrencyCode(currency: string): string {
    let normalizedCode = normalizer.currencyCodeHexToAsciiTrimmed(currency);
    if(!normalizedCode || normalizedCode.trim().length == 0)
      return currency
    else
      return normalizedCode
  }

  applyFilter(event: Event) {
    this.filterText = (event.target as HTMLInputElement).value;
    this.datasource.filter = this.filterText.toLowerCase().trim();

    if (this.datasource.paginator) {
      this.datasource.paginator.firstPage();
    }
  }

  humanReadableCloseTime(): string {
    if(this.ledgerCloseTime != null && this.ledgerCloseTime > 0)
      return new Date(normalizer.rippleEpocheTimeToUTC(this.ledgerCloseTime)).toLocaleString();
    else
      return "";
  }

  getBithompLink(account:string): string {
    return "https://bithomp.com/explorer/"+account;
  }

  getXRPScanLink(account:string): string {
    return "https://xrpscan.com/account/"+account;
  }
}