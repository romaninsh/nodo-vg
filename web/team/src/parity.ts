// Written by scripts/parity.py from docs/todo.md and docs/parity-map.yaml; never edit by hand.

export const PARITY = {
  "odooImage": "odoo:20.0",
  "odooMeasuredOn": "2026-11-28",
  "sections": [
    {
      "name": "Board",
      "features": 21,
      "done": 9,
      "partly": 10,
      "notYet": 2,
      "wont": 0,
      "complete": 67,
      "odoo": {
        "backend": 191,
        "frontend": 378
      },
      "odooMail": 288,
      "nodo": {
        "backend": 274,
        "frontend": 605
      }
    },
    {
      "name": "List",
      "features": 12,
      "done": 4,
      "partly": 3,
      "notYet": 5,
      "wont": 0,
      "complete": 46,
      "odoo": {
        "backend": 27,
        "frontend": 289
      },
      "odooMail": 222,
      "nodo": {
        "backend": 106,
        "frontend": 198
      }
    },
    {
      "name": "Form",
      "features": 17,
      "done": 11,
      "partly": 3,
      "notYet": 2,
      "wont": 1,
      "complete": 78,
      "odoo": {
        "backend": 146,
        "frontend": 145
      },
      "odooMail": 0,
      "nodo": {
        "backend": 348,
        "frontend": 431
      }
    },
    {
      "name": "Search and filters",
      "features": 12,
      "done": 6,
      "partly": 2,
      "notYet": 4,
      "wont": 0,
      "complete": 58,
      "odoo": {
        "backend": 109,
        "frontend": 0
      },
      "odooMail": 52,
      "nodo": {
        "backend": 27,
        "frontend": 62
      }
    },
    {
      "name": "Stages",
      "features": 9,
      "done": 6,
      "partly": 3,
      "notYet": 0,
      "wont": 0,
      "complete": 83,
      "odoo": {
        "backend": 275,
        "frontend": 24
      },
      "odooMail": 0,
      "nodo": {
        "backend": 214,
        "frontend": 105
      }
    },
    {
      "name": "Tags",
      "features": 5,
      "done": 3,
      "partly": 1,
      "notYet": 1,
      "wont": 0,
      "complete": 70,
      "odoo": {
        "backend": 63,
        "frontend": 0
      },
      "odooMail": 0,
      "nodo": {
        "backend": 112,
        "frontend": 126
      }
    },
    {
      "name": "Assignees",
      "features": 6,
      "done": 3,
      "partly": 1,
      "notYet": 2,
      "wont": 0,
      "complete": 58,
      "odoo": {
        "backend": 128,
        "frontend": 424
      },
      "odooMail": 435,
      "nodo": {
        "backend": 248,
        "frontend": 166
      }
    },
    {
      "name": "Activities and chatter",
      "features": 10,
      "done": 3,
      "partly": 2,
      "notYet": 5,
      "wont": 0,
      "complete": 40,
      "odoo": {
        "backend": 5359,
        "frontend": 7104
      },
      "odooMail": 11955,
      "nodo": {
        "backend": 441,
        "frontend": 199
      }
    },
    {
      "name": "Other",
      "features": 14,
      "done": 4,
      "partly": 5,
      "notYet": 2,
      "wont": 3,
      "complete": 59,
      "odoo": {
        "backend": 426,
        "frontend": 114
      },
      "odooMail": 0,
      "nodo": {
        "backend": 58,
        "frontend": 99
      }
    }
  ],
  "shared": {
    "name": "Shared",
    "odoo": {
      "backend": 0,
      "frontend": 0
    },
    "odooMail": 0,
    "nodo": {
      "backend": 391,
      "frontend": 556
    }
  },
  "total": {
    "name": "All",
    "features": 106,
    "done": 49,
    "partly": 30,
    "notYet": 23,
    "wont": 4,
    "complete": 63,
    "odoo": {
      "backend": 6724,
      "frontend": 8478
    },
    "odooMail": 12952,
    "nodo": {
      "backend": 2219,
      "frontend": 2547
    }
  }
} as const;
