// Build brief section 5/8 Phase 4: "transfers liability to the hirer".
// Unlike an appeal (persuasive, AI-drafted, arguing the notice is wrong),
// a transfer-of-liability letter is a factual notification — the vehicle
// was on hire to a named person for the period covering the contravention,
// full stop — so it's a filled-in template, not a Claude call. There's
// nothing here for an LLM to judge or argue; getting the hirer's name,
// address, and hire window right (all read straight off the hire_records
// row a human fleet admin entered) is what matters, and a template can't
// misstate or embellish those the way a generative draft could.

export type TransferLiabilityLetterInput = {
  issuerName: string | null;
  referenceNumber: string | null;
  vrm: string;
  eventDatetime: string | null;
  locationText: string | null;
  hirerName: string;
  hirerAddress: string;
  hireStart: string;
  hireEnd: string;
  hasAgreementAttached: boolean;
};

function formatDate(iso: string | null): string {
  if (!iso) return "the date shown on the notice";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function buildTransferLiabilityLetter(input: TransferLiabilityLetterInput): string {
  const {
    issuerName,
    referenceNumber,
    vrm,
    eventDatetime,
    locationText,
    hirerName,
    hirerAddress,
    hireStart,
    hireEnd,
    hasAgreementAttached,
  } = input;

  const refLine = referenceNumber ? `Notice reference: ${referenceNumber}\n` : "";
  const locationLine = locationText ? ` at ${locationText}` : "";

  return `Dear Sir/Madam,

Re: Notification of hirer details — vehicle registration ${vrm}
${refLine}
I am writing regarding the penalty/parking charge notice issued against the above vehicle for an alleged contravention on ${formatDate(eventDatetime)}${locationLine}.

At the time of the alleged contravention, this vehicle was on hire to the person named below under a signed hire agreement covering the period ${formatDate(hireStart)} to ${formatDate(hireEnd)}:

${hirerName}
${hirerAddress}

${hasAgreementAttached ? "A copy of the signed hire agreement is attached in support of this notification.\n\n" : ""}As the vehicle was in the hirer's possession and control throughout this period, please redirect this notice to the hirer above in line with your organisation's keeper liability process, and confirm that the charge has been transferred accordingly.

Please treat this letter as formal notification for that purpose. If any further information is required to complete the transfer, please contact us using the details on file.

Yours faithfully,
${issuerName ? `\n(Sent regarding your reference with ${issuerName})` : ""}`;
}
