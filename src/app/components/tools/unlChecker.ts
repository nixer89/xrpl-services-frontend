import { Component, ViewChild } from '@angular/core';
import { XummService } from '../../services/xumm.service';
import { rippleEpocheTimeToUTC } from '../../utils/normalizers';
import { createHash } from 'crypto';
import * as BN from 'bn.js';
import * as hashjs from 'hash.js';

import * as rippleKeypairs from "ripple-keypairs";

const elliptic = require('elliptic');
const ed25519 = new elliptic.eddsa('ed25519')
const secp256k1 = new elliptic.ec('secp256k1')

const codec =
{
    address: require('ripple-address-codec')
}

@Component({
  selector: 'unlChecker',
  templateUrl: './unlChecker.html',
  styleUrls: ['./unlChecker.css']
})
export class UnlCheckerComponent {

  constructor(private xummApi:XummService) { }

  @ViewChild('inpxrplaccount') inpxrplaccount;
  unlUrl: string;

  errors:string[] = [];
  validatorNodes:any[] = [];
  unlData:any = null;
  master_public_key:string = null;
  sequence:number = null;

  loading:boolean = false;

  public async checkUNL() {
    this.loading = true;
    try {
      
      this.master_public_key = null;
      this.validatorNodes = [];
      this.errors = [];
      this.unlData = null;

      if(!this.unlUrl.startsWith("http")) {
        this.unlUrl = "https://"+this.unlUrl;
      }
      
      let result;
      try {
        result = await this.getUnlData(this.unlUrl)
      } catch(err) {
        result = null;
      }

      if(!result)
        return;
      //console.log(JSON.stringify(result));

      this.unlData = result.vl;

      //console.log("unldata:")
      //console.log(this.unlData);

      for(let nodePub in result) {
        if(result.hasOwnProperty(nodePub) && nodePub != "vl") {
          this.validatorNodes.push({node_pub: nodePub, signing_pub: result[nodePub].public_key, manifest: result[nodePub].manifest, parsedManifest: result[nodePub].parsedManifest});
        }
      }

      this.validatorNodes = this.validatorNodes.sort((validatorA, validatorB) => {
        if(validatorA.parsedManifest.Domain && validatorB.parsedManifest.Domain)
            return validatorA.parsedManifest.Domain.localeCompare(validatorB.parsedManifest.Domain);
        else if(validatorA.parsedManifest.Domain)
            return -1;
        else return 1;
      })

    } catch(err) {
      this.loading = false;
      console.log(err);
    }

    this.loading = false;
  }

  private parseManifest(buf) {
    let man:any = {};
    let upto = 0;

    let verify_fields = [Buffer.from('MAN\x00', 'utf-8')];
    let last_signing = 0;

    // sequence number
    this.assert(buf[upto++] == 0x24, "Missing Sequence Number")
    man['Sequence'] = (buf[upto] << 24) + (buf[upto+1] << 16) + (buf[upto+2] << 8) + buf[upto+3]
    upto += 4

    // public key
    this.assert(buf[upto++] == 0x71, "Missing Public Key")       // type 7 = VL, 1 = PublicKey
    this.assert(buf[upto++] == 33, "Missing Public Key size")    // one byte size
    man['PublicKey'] = buf.slice(upto, upto + 33).toString('hex')
    upto += 33

    // signing public key
    this.assert(buf[upto++] == 0x73, "Missing Signing Public Key")       // type 7 = VL, 3 = SigningPubKey
    this.assert(buf[upto++] == 33, "Missing Signing Public Key size")    // one byte size
    man['SigningPubKey'] = buf.slice(upto, upto + 33).toString('hex').toUpperCase();
    upto += 33

    // signature
    verify_fields.push(buf.slice(last_signing, upto))
    this.assert(buf[upto++] == 0x76, "Missing Signature")    // type 7 = VL, 6 = Signature
    let signature_size = buf[upto++];
    man['Signature'] = buf.slice(upto, upto + signature_size).toString('hex')
    upto += signature_size
    last_signing = upto

    // domain field | optional
    if (buf[upto] == 0x77)
    {
        upto++
        let domain_size = buf[upto++]
        man['Domain'] = buf.slice(upto, upto + domain_size).toString('utf-8')
        upto += domain_size
        //console.log("DOMAIN: " + man['Domain']);
    }

    // master signature
    verify_fields.push(buf.slice(last_signing, upto))
    this.assert(buf[upto++] == 0x70, "Missing Master Signature lead byte")   // type 7 = VL, 0 = uncommon field
    this.assert(buf[upto++] == 0x12, "Missing Master Signature follow byte") // un field = 0x12 master signature
    let master_size = buf[upto++];
    man['MasterSignature'] = buf.slice(upto, upto + master_size).toString('hex')
    upto += master_size
    last_signing = upto // here in case more fields ever added below

    this.assert(upto == buf.length, "Extra bytes after end of manifest")

    // for signature verification
    man.without_signing_fields = Buffer.concat(verify_fields)
    return man;
  }

  private async getUnlData(url): Promise<any> {
    let json = null;
    try {
      json = await this.xummApi.getUnlData(url);
    } catch(err) {
      console.log(err);
      json = null;
    }

    if(!json) {
      this.errors.push("Error retrieving UNL data.");
      this.errors.push("Please make sure that your provided url does host an UNL!");
      this.loading = false;
      return null;
    }

    try
    {
        // initial json validation
        this.assert(json.public_key !== undefined, "public key missing from vl")
        this.assert(json.signature !== undefined, "signature missing from vl")
        this.assert(json.version !== undefined, "version missing from vl")
        this.assert(json.manifest !== undefined, "manifest missing from vl")
        this.assert(json.blob !== undefined, "blob missing from vl")
        this.assert(json.version == 1, "vl version != 1")

        // check key is recognised
        if (this.master_public_key != null)
          this.assert(json.public_key.toUpperCase() == this.master_public_key.toUpperCase(), "Provided VL key does not match")
        else
          this.master_public_key = json.public_key.toUpperCase()

        // parse blob
        let blob:any = Buffer.from(json.blob, 'base64')

        // parse manifest
        const manifest = this.parseManifest(Buffer.from(json.manifest, 'base64'));
        //console.log(JSON.stringify(manifest));

        // verify manifest signature and payload signature
        let master_key;

        console.log(JSON.stringify(manifest));

        try {

          this.assert(manifest.PublicKey !== undefined, "Property 'PublicKey' missing from manifest with master key: " + this.master_public_key);
          this.assert(manifest.MasterSignature !== undefined, "Property 'MasterSignature' missing from manifest with master key: " + this.master_public_key);
        
          if(manifest.PublicKey.toUpperCase().startsWith('ED')) {
            //console.log("master key ED");
            master_key = ed25519.keyFromPublic(manifest.PublicKey.slice(2), 'hex');
            this.assert(master_key.verify(manifest.without_signing_fields, manifest.MasterSignature),"Master signature in master manifest does not match vl key")
          } else {
            //console.log("master key sec");
            master_key = secp256k1.keyFromPublic(manifest.PublicKey, 'hex');
            this.assert(master_key.verify(manifest.without_signing_fields, manifest.MasterSignature),"Master signature in master manifest does not match vl key")
          }
        } catch(err) {
          this.errors.push("UNL MasterKey can not verify MasterSignature of manifest.");
          this.errors.push("UNL MasterKey: " + master_key);
          this.errors.push("UNL MasterSignature: " + manifest.MasterSignature);
        }
      
        let signing_key = null;

        try {
        
          this.assert(manifest.SigningPubKey !== undefined, "Property 'SigningPubKey' missing from manifest with master key: " + this.master_public_key);

          if(manifest.SigningPubKey.toUpperCase().startsWith('ED')) {
            //console.log("signing key ED");
            signing_key = ed25519.keyFromPublic(manifest.SigningPubKey.slice(2), 'hex')

            this.assert(signing_key.verify(blob.toString('hex'), json.signature), "Payload signature in mantifest failed verification with ED")
          } else {
            console.log("signing key sec");
            console.log(manifest.SigningPubKey);

            signing_key = secp256k1.keyFromPublic(manifest.SigningPubKey.toString('hex'), 'hex');

            console.log(signing_key);
            //sha512 half the blob!
            //https://xrpl.org/cryptographic-keys.html#key-derivation
            let sha512Blob = hashjs.sha512().update(blob);  
            let sha512HalfBuffer = sha512Blob.digest().slice(0,32);

            let result = signing_key.verify(sha512HalfBuffer, json.signature);

            console.log("verify result:")
            console.log(result);

            let result2 = rippleKeypairs.verify(blob.toString("hex"), json.signature, manifest.SigningPubKey);

            console.log("verify result2:")
            console.log(result2);

            this.assert(signing_key.verify(sha512HalfBuffer, json.signature), "Payload signature in mantifest failed verification with SECP256K1")
          }
        } catch(err) {
          this.errors.push("UNL SigningPubKey can not verify signature of blob.");
          this.errors.push("UNL SigningPubKey: " + manifest.SigningPubKey);
          this.errors.push("UNL Signature: " + json.signature);
        }

        blob = JSON.parse(blob)

        //console.log(JSON.stringify(blob));

        this.assert(blob.validators !== undefined, "validators missing from blob")

        json.validator_count = blob.validators.length;

        this.assert(blob.sequence !== undefined, "sequence missing from blob")
        json.sequence = blob.sequence;

        this.assert(blob.expiration !== undefined, "expiration missing from blob")
        json.expiration = this.getUnlExpiration(blob.expiration);

        json.expiration_days_left = this.getUnlExpirationDaysLeft(blob.expiration);

        json.signing_pub_key = manifest.SigningPubKey.toUpperCase();
        json.master_key = manifest.PublicKey.toUpperCase()
        json.master_signature = manifest.MasterSignature.toUpperCase();

        // parse manifests inside blob (actual validator list)
        let unl:any = {}
        for (let idx in blob.validators)
        {
            //console.log((blob.validators[idx]));
            this.assert(blob.validators[idx].manifest !== undefined, "validators list in blob contains invalid entry (missing manifest)")
            this.assert(blob.validators[idx].validation_public_key !== undefined, "validators list in blob contains invalid entry (missing validation public key)")
            
            let parsedManifest = this.parseManifest(Buffer.from(blob.validators[idx].manifest, 'base64'))

            // verify signature
            let signing_key;

            let publicKey = blob.validators[idx].validation_public_key;

            if (publicKey.slice(0, 1) === 'n') {
              const publicKeyBuffer = codec.address.decodeNodePublic(publicKey);
              publicKey = publicKeyBuffer.toString("hex").toUpperCase();
            }

            try {

              this.assert(parsedManifest.MasterSignature !== undefined, "Property 'MasterSignature' missing in validator manifest for: " + blob.validators[idx].validation_public_key);
            
              if(publicKey.toUpperCase().startsWith('ED')) {
                //console.log("VALIDATOR KEY ED")
                //console.log("ed25519");
                signing_key = ed25519.keyFromPublic(publicKey.slice(2), 'hex');
                this.assert(signing_key.verify(parsedManifest.without_signing_fields, parsedManifest.MasterSignature), "Validation manifest " + idx + " signature verification failed");
              } else {
                //console.log("secp256k1");
                //console.log("VALIDATOR KEY SEC")
                signing_key = secp256k1.keyFromPublic(publicKey, 'hex');
                const computedHash = createHash("sha512").update(parsedManifest.without_signing_fields).digest().toString("hex").slice(0, 32);
                this.assert(signing_key.verify(computedHash, parsedManifest.MasterSignature), "Validation manifest " + idx + " signature verification failed");
              }
            } catch(err) {
              this.errors.push("Validator Public Key does not match signature format of the manifest.");
              this.errors.push("Validator Public Key: " + publicKey);
              this.errors.push("Validator Signature: " + parsedManifest.MasterSignature);
            }

            this.assert(parsedManifest.SigningPubKey !== undefined, "Property 'SigningPubKey' missing in validator manifest for: " + blob.validators[idx].validation_public_key);

            blob.validators[idx].validation_public_key = Buffer.from(blob.validators[idx].validation_public_key, 'hex')

            let nodepub = codec.address.encodeNodePublic(Buffer.from(parsedManifest.SigningPubKey, 'hex'))
            unl[nodepub] =
            {
                public_key: parsedManifest.SigningPubKey,
                parsedManifest: parsedManifest,
                manifest: blob.validators[idx].manifest
            }
        }

        return {...unl, vl: json}
    }
    catch (e)
    {
      this.assert(false, e)
    }
  }

  private assert = (c,m) =>
  {
      if (!c) {
          console.log("Invalid manifest: " + (m ? m : ""));
          this.errors.push("Invalid manifest: " + (m ? m : ""))
      }
  }

  private getUnlExpiration(expiration: number): string {
    let timeInMs:number = rippleEpocheTimeToUTC(expiration);
    return new Date(timeInMs).toLocaleString();
  }

  private getUnlExpirationDaysLeft(expiration:number): number {
    let timeInMs:number = rippleEpocheTimeToUTC(expiration);
    let diffTime = timeInMs - Date.now();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private hexToBytes(a): number[] {
    this.assert(a.length % 2 == 0, "Byte length does not match.")
    return new BN(a, 16).toArray(null, a.length / 2)
  }
}
