import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { LocalStorageService } from 'angular-2-local-storage';

declare let gtag: Function;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'XRPL Services';
  darkMode:boolean;

  constructor(private router: Router, private localStorage: LocalStorageService) {
    this.router.events.subscribe(event => {
      if(event instanceof NavigationEnd) {
          let path = (event.urlAfterRedirects.includes('?') ? event.urlAfterRedirects.substring(0, event.urlAfterRedirects.indexOf('?')) : event.urlAfterRedirects);
          gtag('config', 'UA-159404162-1', 
                {
                  'page_title': this.getPageTitle(path),
                  'page_path': path
                }
              );
       }
    });
  }

  getPageTitle(page_path:string): string {
    let title = "XRP Ledger Services";

    switch(page_path) {
      case '': case '/': title = "XRPL Transactions"; break;
      case '/easy-iou': title = "Easy-IOU"; break;
      case '/tokens': title = "XRPL Tokens"; break;
      case '/tools': title = "XRPL Tools"; break;
      case '/terms': title = "XRPL Services Terms"; break;
      case '/privacy': title = "XRPL Services Privacy"; break;
      default: title = "XRPL Services"; break;
    }

    return title;
  }

  ngOnInit(){
    this.localStorage.remove("xrplAccount");
    this.localStorage.remove("testMode");
    let storageKeys:string[] = this.localStorage.keys();
    if(storageKeys && storageKeys.includes('darkMode')) {
      this.darkMode = this.localStorage.get("darkMode");
    }
    else {
      this.darkMode = true;
      this.localStorage.set("darkMode", this.darkMode);
    }
    
    var bodyStyles = document.body.style;
    if(this.darkMode) {
      bodyStyles.setProperty('--background-color', 'rgba(50, 50, 50)');
      //bodyStyles.setProperty('--dialog-background', 'rgba(50, 50, 50)');
      //bodyStyles.setProperty('--dialog-color', '#ffffff');
    }
    else {
        bodyStyles.setProperty('--background-color', 'rgba(238,238,238,.5)');
        //bodyStyles.setProperty('--dialog-background', 'rgba(238,238,238)');
        //bodyStyles.setProperty('--dialog-color', 'rgba(0, 0, 0)');
    }
    // always scroll to the top of the page on route change:
    this.router.events.subscribe(e => e instanceof NavigationEnd ? window.scrollTo(0,0) : null);
  }

  darkModeChanged(isDarkMode:boolean) {
    //console.log(isDarkMode);
    this.darkMode = isDarkMode;
    var bodyStyles = document.body.style;
    if(isDarkMode) {
        bodyStyles.setProperty('--background-color', 'rgba(50, 50, 50)');
        //bodyStyles.setProperty('--dialog-background', 'rgba(50, 50, 50)');
        //bodyStyles.setProperty('--dialog-color', '#ffffff');
        
    }
    else {
        bodyStyles.setProperty('--background-color', 'rgba(238,238,238,.5)');
        //bodyStyles.setProperty('--dialog-background', 'rgba(238,238,238)');
        //bodyStyles.setProperty('--dialog-color', 'rgba(0, 0, 0)');
    }
  }
}
