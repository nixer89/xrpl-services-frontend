import { Component, ViewChild } from '@angular/core';
import { AppService } from '../../services/app.service';
import { XummService } from '../../services/xumm.service';

const elliptic = require('elliptic');
const ed25519 = new elliptic.eddsa('ed25519')

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

      let result = await this.getUnlData(this.unlUrl)
      console.log(JSON.stringify(result));

      this.unlData = result.vl;

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
    man['SigningPubKey'] = buf.slice(upto, upto + 33).toString('hex')
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
        console.log("DOMAIN: " + man['Domain']);
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
    let json = await this.xummApi.getUnlData(url);

    console.log(JSON.stringify(json));

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
          this.assert(json.public_key.toUpperCase() == this.master_public_key.toUpperCase(),
                "Provided VL key does not match")
        else
        this.master_public_key = json.public_key.toUpperCase()

        // parse blob
        let blob:any = Buffer.from(json.blob, 'base64')

        // parse manifest
        const manifest = this.parseManifest(Buffer.from(json.manifest, 'base64'))

        // verify manifest signature and payload signature
        const master_key = ed25519.keyFromPublic(this.master_public_key.slice(2), 'hex')
        this.assert(master_key.verify(manifest.without_signing_fields, manifest.MasterSignature),
            "Master signature in master manifest does not match vl key")
        let signing_key = ed25519.keyFromPublic(manifest.SigningPubKey.slice(2), 'hex')
        this.assert(signing_key.verify(blob.toString('hex'), json.signature),
            "Payload signature in mantifest failed verification")
        blob = JSON.parse(blob)

        this.assert(blob.validators !== undefined, "validators missing from blob")

        // parse manifests inside blob (actual validator list)
        let unl:any = {}
        for (let idx in blob.validators)
        {
            this.assert(blob.validators[idx].manifest !== undefined, "validators list in blob contains invalid entry (missing manifest)")
            this.assert(blob.validators[idx].validation_public_key !== undefined, "validators list in blob contains invalid entry (missing validation public key)")
            
            let parsedManifest = this.parseManifest(Buffer.from(blob.validators[idx].manifest, 'base64'))

            // verify signature
            signing_key = ed25519.keyFromPublic(blob.validators[idx].validation_public_key.slice(2), 'hex')

            this.assert(signing_key.verify(parsedManifest.without_signing_fields, parsedManifest.MasterSignature), "Validation manifest " + idx + " signature verification failed")

            blob.validators[idx].validation_public_key =Buffer.from(blob.validators[idx].validation_public_key, 'hex')
            
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
}
