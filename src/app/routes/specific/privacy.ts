import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
    selector: 'privacy',
    templateUrl: 'privacy.html',
    standalone: false
})

export class PrivacyComponent implements OnInit {

  constructor(private titleService: Title) {}

  ngOnInit() {
    this.titleService.setTitle("XRPL Services Privacy");
  }
}
