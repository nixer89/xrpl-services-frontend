import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'privacy',
  templateUrl: 'privacy.html'
})

export class PrivacyComponent implements OnInit {

  constructor(private titleService: Title) {}

  ngOnInit() {
    this.titleService.setTitle("Xahau Services Privacy");
  }
}
