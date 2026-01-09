"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SignatureCanvas } from "@/components/auth/signature-canvas"
import { useSession } from "@/lib/auth/client"
import {
  Loader2,
  FileSignature,
  ScrollText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

// NDA Content - Full text
const NDA_CONTENT = `# NON-DISCLOSURE AND BETA TESTER AGREEMENT

---

**IMPORTANT DISCLAIMER**: This document is provided as a template only and does not constitute legal advice. This agreement should be reviewed, modified, and approved by qualified legal counsel before use. Laws vary by jurisdiction, and specific circumstances may require additional or different provisions. G-Tech SD makes no representations or warranties regarding the enforceability or suitability of this template for any particular purpose.

---

## NON-DISCLOSURE AGREEMENT

**Between:**

**DISCLOSING PARTY:**
- **Name:** William Griffith
- **Company:** G-Tech SD

(hereinafter referred to as "Disclosing Party," "Company," or "G-Tech SD")

**AND**

**RECEIVING PARTY (Beta Tester):**
(hereinafter referred to as "Receiving Party," "Beta Tester," or "Recipient")

(collectively referred to as the "Parties" and individually as a "Party")

---

## RECITALS

**WHEREAS**, G-Tech SD has developed and is continuing to develop a proprietary AI-powered development platform known as "Claudia Coder" (the "Product" or "Software");

**WHEREAS**, G-Tech SD desires to engage the Receiving Party as a beta tester to evaluate, test, and provide feedback on the Product prior to its commercial release;

**WHEREAS**, in connection with such beta testing, G-Tech SD will disclose certain confidential and proprietary information to the Receiving Party;

**WHEREAS**, the Parties wish to establish the terms and conditions under which such confidential information will be disclosed and protected;

**NOW, THEREFORE**, in consideration of the mutual covenants and agreements contained herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:

---

## ARTICLE 1: DEFINITION OF CONFIDENTIAL INFORMATION

### 1.1 Confidential Information Defined

"Confidential Information" means any and all information, data, materials, know-how, trade secrets, and other proprietary information disclosed by the Disclosing Party to the Receiving Party, whether orally, in writing, electronically, or by any other means, and whether or not marked as confidential, including but not limited to:

a) **Software and Technology**: Source code, object code, algorithms, software architecture, system designs, APIs, user interfaces, database structures, and any other technical components of Claudia Coder;

b) **Product Information**: Features, functionality, specifications, roadmaps, development plans, release schedules, pricing strategies, and marketing plans related to Claudia Coder or any other G-Tech SD products;

c) **Business Information**: Business plans, strategies, financial information, customer lists, vendor relationships, operational methods, and organizational structures;

d) **Documentation**: Technical documentation, user manuals, training materials, design documents, specifications, and any other written or electronic materials;

e) **AI and Machine Learning**: Training data, models, weights, parameters, prompts, fine-tuning methodologies, and any information related to artificial intelligence or machine learning components;

f) **Security Information**: Security protocols, authentication methods, encryption keys, vulnerability assessments, and any information related to the security of the Product;

g) **Third-Party Information**: Any confidential information of third parties that G-Tech SD has received under obligations of confidentiality;

h) **Feedback and Testing Results**: All feedback, bug reports, test results, performance data, and suggestions provided by the Receiving Party during the beta testing period;

i) **Derivative Information**: Any information derived from, based upon, or incorporating any of the above.

### 1.2 Exclusions from Confidential Information

Confidential Information shall not include information that:

a) Was publicly available or in the public domain at the time of disclosure through no fault of the Receiving Party;

b) Becomes publicly available after disclosure through no fault, act, or omission of the Receiving Party;

c) Was rightfully in the possession of the Receiving Party prior to disclosure, as evidenced by written records predating such disclosure;

d) Is rightfully obtained by the Receiving Party from a third party without restriction and without breach of any confidentiality obligation;

e) Is independently developed by the Receiving Party without use of or reference to the Confidential Information, as evidenced by written records.

### 1.3 Burden of Proof

The burden of proving that any information falls within one of the exclusions set forth in Section 1.2 shall rest with the Receiving Party.

---

## ARTICLE 2: OBLIGATIONS OF RECEIVING PARTY

### 2.1 Non-Disclosure Obligation

The Receiving Party agrees to:

a) Hold all Confidential Information in strict confidence;

b) Not disclose, publish, or otherwise reveal any Confidential Information to any third party without the prior written consent of the Disclosing Party;

c) Not use any Confidential Information for any purpose other than the evaluation and testing of the Product as a beta tester;

d) Protect the Confidential Information using at least the same degree of care used to protect its own confidential information, but in no event less than reasonable care.

### 2.2 Limited Disclosure Within Organization

The Receiving Party may disclose Confidential Information only to those of its employees, contractors, or agents who:

a) Have a legitimate need to know such information for the purposes of this Agreement;

b) Have been informed of the confidential nature of such information;

c) Are bound by written confidentiality obligations at least as protective as those contained herein.

The Receiving Party shall be responsible for any breach of this Agreement by any such employees, contractors, or agents.

### 2.3 Prohibited Activities

The Receiving Party shall not:

a) Copy, reproduce, or duplicate any Confidential Information except as necessary for the authorized purposes under this Agreement;

b) Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code, algorithms, or structure of the Product;

c) Create derivative works based on the Confidential Information or the Product;

d) Remove, alter, or obscure any proprietary notices, labels, or marks on any Confidential Information;

e) Use the Confidential Information to develop, enhance, or market any product or service that competes with the Product;

f) Benchmark, test for performance comparison purposes, or publicly discuss the performance characteristics of the Product without prior written consent;

g) Transfer, assign, or sublicense any rights in the Confidential Information to any third party.

### 2.4 Security Measures

The Receiving Party shall implement and maintain appropriate technical, physical, and administrative security measures to protect the Confidential Information from unauthorized access, disclosure, alteration, or destruction.

### 2.5 Notification of Breach

The Receiving Party shall promptly notify the Disclosing Party in writing upon discovery of any unauthorized use or disclosure of Confidential Information, or any other breach of this Agreement, and shall cooperate with the Disclosing Party in every reasonable way to help regain possession of the Confidential Information and prevent further unauthorized use or disclosure.

---

## ARTICLE 3: TERM AND DURATION

### 3.1 Term of Agreement

This Agreement shall become effective on the Effective Date set forth above and shall continue in effect until terminated by either Party in accordance with Section 3.3.

### 3.2 Duration of Confidentiality Obligations

The confidentiality obligations set forth in this Agreement shall survive the termination or expiration of this Agreement and shall continue for a period of **three (3) years** following:

a) The termination or expiration of this Agreement; or

b) The official public release of the Product (whichever occurs later);

provided, however, that with respect to trade secrets, the confidentiality obligations shall continue for as long as such information qualifies as a trade secret under applicable law.

### 3.3 Termination

a) Either Party may terminate this Agreement at any time by providing thirty (30) days' prior written notice to the other Party;

b) The Disclosing Party may terminate this Agreement immediately upon written notice if the Receiving Party breaches any provision of this Agreement;

c) This Agreement shall automatically terminate upon the conclusion of the beta testing program, unless extended by mutual written agreement.

### 3.4 Effect of Termination

Upon termination or expiration of this Agreement, or upon the Disclosing Party's written request:

a) All rights and licenses granted to the Receiving Party shall immediately cease;

b) The Receiving Party shall comply with the return of materials obligations set forth in Article 5;

c) The confidentiality obligations shall survive as set forth in Section 3.2.

---

## ARTICLE 4: PERMITTED DISCLOSURES

### 4.1 Legally Required Disclosures

Notwithstanding any other provision of this Agreement, the Receiving Party may disclose Confidential Information to the extent required by:

a) Applicable law, statute, or regulation;

b) A valid order of a court of competent jurisdiction;

c) A valid subpoena, civil investigative demand, or similar legal process;

d) A government agency or regulatory authority with jurisdiction over the Receiving Party.

### 4.2 Conditions for Legally Required Disclosure

In the event the Receiving Party is required to make a disclosure pursuant to Section 4.1, the Receiving Party shall:

a) Provide the Disclosing Party with prompt written notice of such requirement (to the extent legally permitted) to allow the Disclosing Party an opportunity to seek a protective order or other appropriate remedy;

b) Cooperate with the Disclosing Party, at the Disclosing Party's expense, in seeking such protective order or other remedy;

c) Disclose only such portion of the Confidential Information as is legally required;

d) Use reasonable efforts to obtain assurances that confidential treatment will be accorded to any Confidential Information so disclosed.

---

## ARTICLE 5: RETURN OF MATERIALS

### 5.1 Return or Destruction

Upon termination or expiration of this Agreement, or upon the Disclosing Party's written request at any time, the Receiving Party shall, at the Disclosing Party's option:

a) Promptly return to the Disclosing Party all documents, materials, and other tangible items containing or embodying any Confidential Information, together with all copies thereof; or

b) Destroy all such documents, materials, and items, and certify such destruction in writing to the Disclosing Party.

---

## ARTICLE 6: NO LICENSE GRANTED

### 6.1 Retention of Rights

All Confidential Information shall remain the sole and exclusive property of the Disclosing Party. Nothing in this Agreement shall be construed as granting to the Receiving Party any right, title, or interest in or to any Confidential Information, whether by license, estoppel, implication, or otherwise.

### 6.2 No Implied Rights

No license or right under any patent, copyright, trademark, trade secret, or other intellectual property right is granted by this Agreement or by any disclosure of Confidential Information hereunder, except for the limited right to use the Product for beta testing purposes as expressly set forth herein.

---

## ARTICLE 7: REMEDIES AND INJUNCTIVE RELIEF

### 7.1 Acknowledgment of Irreparable Harm

The Receiving Party acknowledges and agrees that:

a) The Confidential Information is unique and valuable;

b) Any unauthorized use or disclosure of the Confidential Information would cause irreparable harm to the Disclosing Party;

c) Monetary damages alone would be inadequate to compensate for such harm;

d) The exact amount of damages that would result from a breach would be difficult or impossible to ascertain.

### 7.2 Injunctive Relief

In the event of any actual or threatened breach of this Agreement by the Receiving Party:

a) The Disclosing Party shall be entitled to seek injunctive relief, including temporary restraining orders, preliminary injunctions, and permanent injunctions, to prevent or restrain such breach;

b) The Receiving Party hereby waives any requirement for the posting of a bond or other security as a condition to obtaining such relief;

c) The Receiving Party agrees not to raise any defense of adequate remedy at law in any proceeding for such relief.

---

## ARTICLE 8: GOVERNING LAW AND DISPUTE RESOLUTION

### 8.1 Governing Law

This Agreement shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of laws principles.

### 8.2 Jurisdiction and Venue

The Parties irrevocably submit to the exclusive jurisdiction of the state and federal courts located in San Diego County, California for the purpose of any suit, action, or other proceeding arising out of or relating to this Agreement.

### 8.3 Waiver of Jury Trial

TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, EACH PARTY HEREBY IRREVOCABLY WAIVES ANY RIGHT IT MAY HAVE TO A TRIAL BY JURY IN ANY LEGAL PROCEEDING DIRECTLY OR INDIRECTLY ARISING OUT OF OR RELATING TO THIS AGREEMENT OR THE TRANSACTIONS CONTEMPLATED HEREBY.

---

## ARTICLE 9: SEVERABILITY

If any provision of this Agreement is held by a court of competent jurisdiction to be invalid, illegal, or unenforceable:

a) Such provision shall be modified to the minimum extent necessary to make it valid, legal, and enforceable while preserving the original intent of the Parties;

b) If such modification is not possible, such provision shall be severed from this Agreement;

c) The validity, legality, and enforceability of the remaining provisions shall not be affected or impaired thereby.

---

## ARTICLE 10: ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the Parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, understandings, negotiations, and discussions, whether oral or written, between the Parties relating to such subject matter.

---

## ARTICLE 11: BETA TESTER AGREEMENT

### 11.1 No Warranty / As-Is Software

THE PRODUCT IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.

G-TECH SD DOES NOT WARRANT THAT THE PRODUCT WILL MEET THE RECEIVING PARTY'S REQUIREMENTS, THAT THE OPERATION OF THE PRODUCT WILL BE UNINTERRUPTED OR ERROR-FREE, THAT DEFECTS WILL BE CORRECTED, OR THAT THE PRODUCT IS FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.

THE RECEIVING PARTY ACKNOWLEDGES THAT THE PRODUCT IS IN BETA DEVELOPMENT AND MAY CONTAIN BUGS, ERRORS, AND OTHER PROBLEMS THAT COULD CAUSE SYSTEM FAILURES, DATA LOSS, OR OTHER ISSUES.

### 11.2 Feedback Ownership

All Feedback shall be and remain the sole and exclusive property of G-Tech SD. The Receiving Party hereby irrevocably assigns to G-Tech SD all right, title, and interest in and to all Feedback, including all intellectual property rights therein.

### 11.3 No Redistribution

The Receiving Party agrees that the Product is licensed, not sold, and is provided solely for the Receiving Party's personal use in beta testing. The Receiving Party shall not distribute, sublicense, lease, rent, loan, sell, or otherwise transfer the Product or any copy thereof to any third party.

---

## ACKNOWLEDGMENT

By signing below, the Receiving Party acknowledges that:

1. They have read and understood this entire Agreement;
2. They have had the opportunity to consult with legal counsel;
3. They voluntarily agree to be bound by all terms and conditions herein;
4. They understand the serious legal consequences of breaching this Agreement.

---

**Document Version:** 1.0
**Last Updated:** January 2025
**Prepared For:** Claudia Coder Beta Testing Program

---

*This document is confidential and proprietary to G-Tech SD. Unauthorized reproduction or distribution is prohibited.*
`

export default function NdaPage() {
  const router = useRouter()
  const { data: session, isPending: isSessionLoading } = useSession()
  const scrollAreaRef = React.useRef<HTMLDivElement>(null)

  const [hasScrolledToBottom, setHasScrolledToBottom] = React.useState(false)
  const [fullName, setFullName] = React.useState("")
  const [signature, setSignature] = React.useState<string | null>(null)
  const [signatureType, setSignatureType] = React.useState<"typed" | "drawn">(
    "typed"
  )
  const [typedSignature, setTypedSignature] = React.useState("")
  const [agreedToTerms, setAgreedToTerms] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Check scroll position
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const isAtBottom =
      Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) <
      50
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true)
    }
  }

  // Handle signature canvas change
  const handleSignatureChange = (sig: string | null) => {
    setSignature(sig)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Validate
      if (!hasScrolledToBottom) {
        setError("Please read the entire agreement before signing")
        setIsSubmitting(false)
        return
      }

      if (!fullName.trim()) {
        setError("Please enter your full legal name")
        setIsSubmitting(false)
        return
      }

      const finalSignature =
        signatureType === "typed" ? typedSignature : signature
      if (!finalSignature) {
        setError("Please provide your signature")
        setIsSubmitting(false)
        return
      }

      if (!agreedToTerms) {
        setError("You must agree to the terms")
        setIsSubmitting(false)
        return
      }

      // Submit to API
      const response = await fetch("/api/nda", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          signature: finalSignature,
          signatureType,
          agreedToTerms,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to sign NDA")
      }

      setSuccess(true)

      // Redirect after a brief delay
      setTimeout(() => {
        router.push("/")
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsSubmitting(false)
    }
  }

  // Redirect if not logged in
  React.useEffect(() => {
    if (!isSessionLoading && !session) {
      router.push("/auth/login?callbackUrl=/auth/nda")
    }
  }, [session, isSessionLoading, router])

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">NDA Signed</h1>
          <p className="text-muted-foreground mt-2">
            Thank you for signing the Non-Disclosure Agreement. You will be
            redirected to the dashboard shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ScrollText className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Beta Tester Agreement
        </h1>
        <p className="text-muted-foreground mt-2">
          Please read and sign the Non-Disclosure Agreement to continue
        </p>
      </div>

      {/* NDA Scroll Area */}
      <div className="border rounded-lg">
        <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-medium">
            Non-Disclosure Agreement v1.0
          </span>
          {hasScrolledToBottom ? (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Read completely
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Scroll to read entire document
            </span>
          )}
        </div>
        <ScrollArea
          ref={scrollAreaRef}
          className="h-[400px] p-4"
          onScroll={handleScroll}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {NDA_CONTENT}
            </pre>
          </div>
        </ScrollArea>
      </div>

      {/* Signing Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Legal Name *</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Enter your full legal name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={session?.user?.email || ""}
            readOnly
            disabled
            className="bg-muted"
          />
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="text"
            value={currentDate}
            readOnly
            disabled
            className="bg-muted"
          />
        </div>

        {/* Signature Type Toggle */}
        <div className="space-y-2">
          <Label>Signature Method</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={signatureType === "typed" ? "default" : "outline"}
              size="sm"
              onClick={() => setSignatureType("typed")}
            >
              Type Signature
            </Button>
            <Button
              type="button"
              variant={signatureType === "drawn" ? "default" : "outline"}
              size="sm"
              onClick={() => setSignatureType("drawn")}
            >
              Draw Signature
            </Button>
          </div>
        </div>

        {/* Signature Input */}
        <div className="space-y-2">
          <Label>
            {signatureType === "typed" ? "Type Your Signature *" : "Draw Your Signature *"}
          </Label>
          {signatureType === "typed" ? (
            <Input
              type="text"
              placeholder="Type your full name as signature"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              className="font-signature text-xl italic"
              style={{ fontFamily: "'Brush Script MT', cursive" }}
              disabled={isSubmitting}
            />
          ) : (
            <SignatureCanvas onSignatureChange={handleSignatureChange} />
          )}
        </div>

        {/* Agreement Checkbox */}
        <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30">
          <Checkbox
            id="agree"
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
            disabled={isSubmitting}
          />
          <div className="space-y-1">
            <Label htmlFor="agree" className="font-normal cursor-pointer">
              I have read, understand, and agree to be bound by this
              Non-Disclosure and Beta Tester Agreement
            </Label>
            <p className="text-xs text-muted-foreground">
              By checking this box and signing, you acknowledge that this
              creates a legally binding agreement.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={
            isSubmitting ||
            !hasScrolledToBottom ||
            !agreedToTerms ||
            !fullName.trim() ||
            (signatureType === "typed" ? !typedSignature : !signature)
          }
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing Agreement...
            </>
          ) : (
            <>
              <FileSignature className="mr-2 h-4 w-4" />
              Sign NDA and Continue
            </>
          )}
        </Button>

        {/* Help Text */}
        {!hasScrolledToBottom && (
          <p className="text-center text-sm text-muted-foreground">
            Please scroll to the bottom of the agreement to enable signing
          </p>
        )}
      </form>
    </div>
  )
}
