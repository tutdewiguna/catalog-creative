export type BankInstructionSet = {
  [channel: string]: string[];
};

export type BankInstructionsData = {
  [bankCode: string]: BankInstructionSet;
};

export const bankCodes = {
  BCA: "BCA",
  BNI: "BNI",
  BRI: "BRI",
  MANDIRI: "Mandiri",
  PERMATA: "Permata",
  CIMB: "CIMB Niaga",
  BSI: "BSI",
  BJB: "BJB",
  BSS: "Bank Sahabat Sampoerna",
} as const;


export const bankInstructions: BankInstructionsData = {
  [bankCodes.BCA]: {
    "ATM BCA": [
      "Insert your ATM card and enter your PIN.",
      "Select 'Other Transactions' → 'Transfer' → 'To BCA Virtual Account'.",
      "Enter the Virtual Account number displayed above.",
      "Enter the payment amount if required.",
      "Confirm the details and complete the transaction."
    ],
    "BCA Mobile": [
      "Open BCA Mobile, choose 'm-BCA', and enter your access code.",
      "Tap 'm-Transfer' → 'BCA Virtual Account'.",
      "Enter the Virtual Account number and tap 'Send'.",
      "Verify the recipient details and payment amount.",
      "Enter your m-BCA PIN and confirm your payment."
    ],
    "KlikBCA": [
      "Login to KlikBCA Individual via browser (https://ibank.klikbca.com).",
      "Select 'Transfer Dana' → 'Transfer ke BCA Virtual Account'.",
      "Enter the Virtual Account number.",
      "Enter the payment amount.",
      "Confirm the transaction using your KeyBCA response."
    ]
  },
  [bankCodes.BNI]: {
    "ATM BNI": [
      "Insert your ATM card and enter your PIN.",
      "Select 'Other Menu' → 'Transfer' → 'Virtual Account Billing'.",
      "Enter the Virtual Account number shown above.",
      "The bill details will appear. Confirm if correct.",
      "Complete the transaction."
    ],
    "BNI Mobile Banking": [
      "Open the BNI Mobile Banking app and log in.",
      "Select 'Transfer' → 'Virtual Account Billing'.",
      "Select the source account.",
      "Input the Virtual Account number.",
      "Confirm the transaction details and enter your Transaction Password."
    ],
    "BNI Internet Banking": [
      "Login to BNI Internet Banking (https://ibank.bni.co.id).",
      "Select 'Transfer' → 'Virtual Account Billing'.",
      "Enter the Virtual Account number.",
      "Select the source account and click 'Lanjut'.",
      "Confirm the details and enter your BNI e-Secure response."
    ]
  },
  [bankCodes.BRI]: {
    "ATM BRI": [
      "Insert your BRI ATM card and enter your PIN.",
      "Select 'Other Transactions' → 'Payments' → 'Other' → 'BRIVA'.",
      "Enter the Virtual Account number above.",
      "The payment details will be displayed. Press 'Yes' to confirm.",
      "Complete the transaction."
    ],
    "BRImo": [
      "Open the BRImo app and log in.",
      "Select 'Payments' or 'Bayar' → 'BRIVA'.",
      "Input the Virtual Account number.",
      "Verify the transaction details and payment amount.",
      "Enter your BRImo PIN to confirm."
    ],
    "Internet Banking BRI": [
      "Login to BRI Internet Banking (https://ib.bri.co.id).",
      "Select 'Payments' or 'Pembayaran' → 'BRIVA'.",
      "Enter the Virtual Account number.",
      "Confirm payment details and enter your password and mToken."
    ]
  },
  [bankCodes.MANDIRI]: {
    "ATM Mandiri": [
      "Insert your ATM card and enter your PIN.",
      "Select 'Bayar/Beli' → 'Lainnya' → 'Multi Payment'.",
      "Enter the Service Provider code (e.g., 88888 or specific code if provided) then press 'Benar'.",
      "Enter the Virtual Account number displayed above, then press 'Benar'.",
      "Confirm the details and payment amount, then press 'Ya'.",
      "Complete the payment."
    ],
    "Livin’ by Mandiri": [
      "Open the Livin’ by Mandiri app and log in.",
      "Select 'Bayar'.",
      "Search for the Service Provider or enter the code (e.g., 88888).",
      "Enter the Virtual Account number.",
      "Verify the payment details and tap 'Lanjut Bayar'.",
      "Enter your MPIN to confirm."
    ],
    "Mandiri Internet Banking": [
      "Login to Mandiri Internet Banking (https://ibank.bankmandiri.co.id).",
      "Select 'Pembayaran' → 'Multi Payment'.",
      "Select the source account.",
      "Choose the Service Provider or enter the code.",
      "Input the Virtual Account number and click 'Lanjutkan'.",
      "Confirm the details and enter your Mandiri Token response."
    ]
  },
  [bankCodes.PERMATA]: {
    "ATM Permata": [
      "Insert your ATM card and enter your PIN.",
      "Select 'Other Transactions' → 'Payment' → 'Other Payment' → 'Virtual Account'.",
      "Input the Virtual Account number above and press 'Correct'.",
      "Payment details appear. Confirm if correct.",
      "Complete the transaction."
    ],
    "PermataMobile X": [
      "Open the PermataMobile X app and log in.",
      "Select 'Pay Bills' or 'Bayar Tagihan' → 'Virtual Account'.",
      "Enter the Virtual Account number and tap 'Next'.",
      "Confirm the payment details and enter your Mobile PIN."
    ],
    "PermataNet": [
      "Login to PermataNet (https://new.permatanet.com).",
      "Select 'Paying Bills' → 'Virtual Account'.",
      "Select the source account.",
      "Enter the Virtual Account number and click 'Submit'.",
      "Confirm the details and enter your Token response."
    ]
  },
  [bankCodes.CIMB]: {
    "ATM CIMB": [
      "Insert your ATM card and enter your PIN.",
      "Select 'Transfer' → 'Other CIMB Niaga Account' → 'Virtual Account'.",
      "Enter the Virtual Account number above.",
      "Confirm the amount and complete payment."
    ],
    "OCTO Mobile": [
      "Open the OCTO Mobile app and log in.",
      "Choose 'Transfer' → 'Transfer to Other CIMB Niaga Account'.",
      "Select 'Virtual Account' as the destination.",
      "Input the Virtual Account number.",
      "Enter the amount, confirm, and enter your OCTO Mobile PIN."
    ],
    "CIMB Clicks": [
      "Login to CIMB Clicks (https://www.octoclicks.co.id).",
      "Go to 'Transfer'.",
      "Select 'Virtual Account' as the destination account type.",
      "Enter the Virtual Account number.",
      "Enter the amount, confirm, and enter your mPIN."
    ]
  },
  [bankCodes.BSI]: {
    "ATM BSI": [
      "Insert your BSI ATM card and enter your PIN.",
      "Select 'Other Menu' → 'Payment' → 'Virtual Account'.",
      "Input the Virtual Account number above.",
      "Confirm payment."
    ],
    "BSI Mobile": [
      "Open BSI Mobile app.",
      "Select 'Payment' → 'Virtual Account Billing'.",
      "Enter the Virtual Account number and confirm payment."
    ],
    "BSI Net Banking": [
      "Login to BSI Net Banking.",
      "Select 'Payment' → 'Virtual Account'.",
      "Input the Virtual Account number and confirm."
    ]
  },
  [bankCodes.BJB]: {
    "ATM BJB": [
      "Insert your ATM card and enter your PIN.",
      "Select 'Payment' → 'Virtual Account'.",
      "Input the Virtual Account number.",
      "Confirm payment."
    ],
    "BJB Digi": [
      "Open BJB Digi app.",
      "Select 'Payment' → 'Virtual Account'.",
      "Enter the Virtual Account number and confirm."
    ],
    "BJB Net": [
      "Login to BJB Net.",
      "Select 'Payment' → 'Virtual Account'.",
      "Input the Virtual Account number and confirm."
    ]
  },
  [bankCodes.BSS]: {
    "ATM Bersama / Prima / Alto": [
        "Insert your ATM card and enter your PIN.",
        "Choose 'Transfer' → 'To Other Bank Account'.",
        "Enter the bank code for Bank Sahabat Sampoerna (523).",
        "Enter the full Virtual Account number.",
        "Enter the payment amount.",
        "Confirm the transfer details and finish."
      ],
    "Sampoerna Mobile Banking": [
      "Open Sampoerna Mobile Banking app.",
      "Select 'Transfer' → 'Virtual Account'.",
      "Input the Virtual Account number and confirm."
    ]
  }
};

export const fallbackInstructions: BankInstructionSet = {
  "General Payment Steps": [
    "Open your bank's ATM, Mobile Banking, or Internet Banking.",
    "Select the Virtual Account payment or Transfer option.",
    "If transferring to another bank, enter the destination bank code first.",
    "Enter the Virtual Account number shown above.",
    "Enter the exact payment amount if required.",
    "Review the transaction details carefully (recipient name and amount).",
    "Confirm your payment before the deadline."
  ]
};