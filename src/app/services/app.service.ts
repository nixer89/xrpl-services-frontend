import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from 'rxjs';

@Injectable()
export class AppService {

    constructor(private http: HttpClient) {}

    requestOptions() {
        let headers = new HttpHeaders();
        headers = headers.append('Content-Type', 'application/json');
        return { headers: headers };
    }

    handleResponse(request: Observable<Object>): Promise<any> {
        return request.toPromise()
               .catch(err => this.handleError(err));
    }

    get(url): Promise<any>  {
        return this.handleResponse(this.http.get(url, this.requestOptions()));
    }

    getText(url): Promise<any>  {
        return this.handleResponse(this.http.get(url, {responseType: "text"}));
    }

    post(url, data): Promise<any>  {
        return this.handleResponse(this.http.post(url, data, this.requestOptions()));
    }

    put(url, data): Promise<any>  {
        return this.handleResponse(this.http.put(url, data, this.requestOptions()));
    }

    delete(url): Promise<any>  {
        return this.handleResponse(this.http.delete(url, this.requestOptions()));
    }

    isAvailable(url): Promise<any> {
        return this.handleResponse(this.http.get(url, {responseType: "text"}));
    }

    private handleError(error: any): Promise<any> {
        console.error('An error occurred', JSON.stringify(error)); // XXX for debugging purposes
        if (!error.status) error.message = "Sorry, it cannot be reached.";
        let errmsg: string = error.error.message || error.message || error;
        return Promise.reject(errmsg);
    }
}
