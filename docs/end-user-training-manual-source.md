# End-User Training Manual Source

**Product:** Inventory Intelligence  
**Organization:** Tropical Battery Company Limited  
**Document type:** End-user training source (plain language)  
**Scope:** Visible user interface and confirmed workflows only  

---

## 1. About the System

**System name:** Inventory Intelligence

**What the system does:**  
Inventory Intelligence helps Tropical Battery staff see stock levels, identify which items need replenishment, build purchase orders, send them through an approval process, track expected inbound containers, clean up data problems, and monitor whether inventory data is staying up to date.

**Main purpose:**  
Support day-to-day inventory buying decisions and purchase-order workflow from recommendation → cart → review → approval → send.

**Business activities it supports:**
- Reviewing reorder recommendations and stock risk
- Building and approving purchase orders
- Tracking inbound containers and arrivals
- Maintaining supplier and item reference information
- Spotting data exceptions that need cleanup
- Checking connector / sync health
- Managing who can buy vs approve (approvers only)

**Who should use it:**
- Buyers who review stock and create purchase orders
- Approvers who approve (or return) purchase orders and manage user roles/passwords

**Main benefits:**
- One place to see what needs ordering
- Clear purchase-order statuses and approval steps
- Cart and review flow that groups lines by supplier
- Alerts when purchase orders need attention
- AI assistant available for questions about inventory and purchasing context

**Main sections (sidebar menu):**
1. Dashboard  
2. Reorder  
3. Inventory  
4. Purchase Orders  
5. Inbound Containers  
6. Exceptions  
7. Reference Data  
8. Users *(approvers only)*  
9. Connector Health  

---

## 2. User Roles

The system uses two roles shown to users: **Buyer** and **Approver**.

Anyone without a special role assignment is treated as a **Buyer**.

### Buyer

**Purpose:** Review inventory recommendations, build purchase orders, and manage drafts.

**Can view:** Dashboard, Reorder, Inventory, Purchase Orders, Inbound Containers, Exceptions, Reference Data, Connector Health; own notifications; PO cart.

**Can create:** Purchase order cart lines; purchase orders (as draft or sent for approval from review); inbound container entries / uploads (as available on that screen); reference-data rows (as available).

**Can edit:** Cart quantities and suppliers (with lock rules); draft POs (via allowed status actions); reference data; inbound records (as available).

**Can submit:** Send a draft purchase order for approval; create POs from the review screen (“Create and send for approval” or “Save as draft”).

**Can approve or reject:** No. Buyers cannot approve purchase orders.

**Cannot do:**
- Approve purchase orders
- Open the **Users** menu (hidden) or `/users` screen (redirected away)
- Override a locked vendor without approver rights
- Demote or change other users’ roles

### Approver

**Purpose:** Approve or return purchase orders, override vendor locks when needed, and manage user roles and passwords.

**Can view:** Everything buyers can view, plus **Users**.

**Can create / edit / submit:** Same purchasing capabilities as buyers, plus role assignment and password setting for other users.

**Can approve or reject:**
- **Approve purchase order** (when status is Pending approval)
- **Return to buyer** (requires a note)
- **Suppress** (requires a note)
- Cannot approve a purchase order they themselves created

**Cannot do:**
- Remove their own Approver role from the Users screen
- Demote the last remaining Approver

### Permissions overview

| User role | Can view | Can create | Can edit | Can approve | Main responsibilities |
| --------- | -------- | ---------- | -------- | ----------- | --------------------- |
| Buyer | All main menus except Users | PO cart lines, POs from review, reference/inbound updates as available | Own drafts and cart; stock-related screens | No | Replenish stock; prepare and send POs for approval |
| Approver | All menus including Users | Same as buyer + user role rows | Same as buyer + roles/passwords; vendor lock overrides | Yes (not on own POs) | Approve/return POs; manage access |

---

## 3. Accessing the System

### Opening the system
1. Open the Inventory Intelligence web address provided by your organization.  
2. If you are not signed in, you are taken to the **Sign in** screen.

### Logging in
1. Enter your **Email address**.  
2. Enter your **Password**.  
3. Optionally use the eye icon to show or hide the password.  
4. Select **Sign in**.  
5. On success you go to the **Dashboard**.

**Messages you may see:**
- Sign-in failure shows the error returned by the sign-in service (for example incorrect credentials).

### Completing the first login
**Requires confirmation from the system owner** how new accounts are first created and how the first temporary password is shared. Approvers can set a password on the **Users** screen for emails that already have a sign-in account.

### Resetting a forgotten password (self-serve)
1. On the sign-in screen, select **Forgot password?**  
2. Enter your email.  
3. Select **Send reset link**.  
4. You always see: **If that email has an account, a reset link is on its way.** (This does not confirm whether the email exists.)  
5. Open the link in the email.  
6. On **Set a new password**, enter **New password** and **Confirm password** (at least 8 characters, must match).  
7. Select **Set password**.  
8. After **Password updated**, select **Sign in** and sign in with the new password.

**If the reset link is invalid or expired:**  
You see: **This reset link has expired or is invalid. Request a new one from the login page.** with **Back to login**.

**If you open the update-password page without a valid reset session:**  
Same invalid-link message (no password form).

### Changing your password while signed in
1. In the left sidebar footer, select your avatar / email.  
2. Expand **Change password**.  
3. Enter **Current password**, **New password**, and **Confirm new password**.  
4. Select **Update password**.  
5. Success message: **Password updated.**

**If the current password is wrong:** **Current password is incorrect.** (password is not changed)

**Local validation:** empty current password; new password under 8 characters; new and confirm do not match.

### Multi-factor authentication
**Requires confirmation from the system owner** — no multi-factor prompts were confirmed in the visible login flow.

### Logging out
1. Open the account menu from your sidebar avatar.  
2. Select **Sign out**.  
3. You return to the sign-in screen.

### Expired session / access denied
- If your session ends, you are sent back to **Sign in**.  
- Buyers who open **Users** are redirected to **Reorder**.  
- Approver-only actions return a forbidden response if attempted without permission.

### Common login problems

| Problem | What to try |
| ------- | ----------- |
| Cannot sign in | Check email/password; use Forgot password?; ask an Approver to set a password if you have no working password |
| No reset email | Check spam; confirm the email is correct; wait and retry (rate limits may apply) |
| Reset link fails | Request a new link from Forgot password? |
| Password rules | Use at least 8 characters; new and confirm must match |

---

## 4. Navigating the System

### Main menu (left sidebar)
Always-visible items (all signed-in users):
- **Dashboard**
- **Reorder**
- **Inventory**
- **Purchase Orders**
- **Inbound Containers**
- **Exceptions**
- **Reference Data**
- **Connector Health**

Approver-only:
- **Users**

### Top bar
- Page title and subtitle for the current area  
- **Purchase order cart** icon (shows item count badge)  
- **Notifications** bell (unread count)  
- Avatar initial (display only in the top bar)

### User profile menu
Bottom of the sidebar: avatar, email, role (**Buyer** or **Approver**), **Change password**, **Sign out**.

### Notifications
Bell opens a panel titled **Notifications** with **Mark all read**. Empty state: **No notifications yet**.

Confirmed notification title patterns users may see:
- **{PO number} awaiting approval** (body may include who submitted and the total)
- **{PO number} approved by {email}**
- **{PO number} suppressed by {email}**

### Ask AI
Floating **Ask AI** button (bottom right) opens the **Inventory AI** sidebar (badge **Live data**). Suggested starter questions include:
- Which SKUs are below reorder level?
- What is my Atlas supplier exposure?
- Show items with no sales in 90 days
- Top 10 SKUs by inventory value  

Close the panel when finished. Review any AI answers before acting on them.

### Search
Search appears on list screens (for example Inventory, Reorder filters/saved views, Reference Data, Exceptions) as each page provides—not one global search bar.

### Breadcrumbs
**Requires confirmation from the system owner** whether breadcrumb trails are used beyond back links such as **Back to reorder** on the PO review screen.

### Mobile navigation
**Requires confirmation from the system owner** for phone-specific navigation differences. On desktop, navigation is the fixed left sidebar.

### Menu item summary

| Menu | Opens | Who sees it | Typical work |
| ---- | ----- | ----------- | ------------ |
| Dashboard | Overview metrics and charts | All | Check risk and exceptions at a glance |
| Reorder | Reorder recommendations tabs | All | Decide what to order; add to PO cart |
| Inventory | On-hand inventory browse | All | Look up stock by SKU |
| Purchase Orders | PO list and detail | All | Create, approve, send POs |
| Inbound Containers | Expected containers | All | Upload/manage arrivals |
| Exceptions | Data exceptions | All | Find data cleanup issues |
| Reference Data | Supplier–item reference | All | Maintain quotes and supplier fields |
| Users | Role and password admin | Approvers | Assign roles; set passwords |
| Connector Health | Sync health | All | See if data feeds look healthy |

---

## 5. Dashboard

**Purpose:** High-level view of catalog size, inventory value, replenishment pressure, critical items, exceptions, seasonal intelligence, charts, and recent sync activity.

**What appears (confirmed labels):**
- **Total SKUs** (trend: Active catalog; may show how many are in active workflow)
- **Inventory Value (J$)** (trend: Current valuation)
- **Items Below Reorder** (Needs replenishment / All above reorder level)
- **Critical Items** (Immediate action required / No critical items)
- **Data Exceptions** card (links to Exceptions; may show negative stock / missing supplier / stale demand counts, or **All clear**)
- **Seasonal Intelligence** — AI analysis of 13-month sales patterns; **Refresh Analysis**; peak/order-window guidance; note that with a 93-day lead time, replenishment must be planned a full quarter ahead
- **Stock Status** chart (Critical / Watch / OK; note may mention SKUs with no recent demand not shown)
- **Top SKUs by Annual Demand**, **Value by Category**
- **Last Sync** / sync activity
- **Recent Purchase Orders**
- **Items Needing Attention** with link **View all in Reorder →**

**Role differences:** Same dashboard layout for Buyer and Approver (Users menu is separate).

**Actions from dashboard:** **Data Exceptions** opens Exceptions; **View all in Reorder →** opens Reorder; **Refresh Analysis** on Seasonal Intelligence.

---

## 6. System Modules

### Dashboard
Overview metrics and health. All users.

### Reorder
Tabs: **Reorder Action**, **Overstock**, **Non-Stock Items**, **Unclassified**. Status chips/filters: **Critical**, **Watch**, **Reorder Needed**, **OK (well stocked)**. Row badges also include **No Demand**. Batch **Add selected to PO**; row **Add to PO**; **Export CSV** / **Export PDF**; optional **AI Summary** / per-item **Analysis** explanation. Purchasing may show **No buy** when blocked by buyer rules.

### Inventory
Browse on-hand inventory; filters for Status (**Critical**, **Reorder Needed**, **OK**, **No Activity**), Class/Category, **Show inactive items**; search; saved views; **Export CSV**. Table status badges use **No Demand** for the same underlying “no recent demand” condition (filter wording differs—see §12).

### Purchase Orders
Summary cards: **Draft POs**, **Awaiting approval**, **Approved this month**, **Approved value this month**. Tabs: **All**, **Drafts**, **Awaiting approval (n)**, **Approved**, **Sent**; **Show archive** / **Hide archive**. List actions include **Send for approval**, **Review and approve**, **View status**, **Send to supplier**, **View PO**, **Download PDF**, **Suppress PO**. Detail: transitions, PDF, email, **Activity** trail. Review: **Review cart and create POs**.

### Inbound Containers
**Add container**, **Upload sheet** (Excel `.xlsx`), **Refresh from file**; mark **Arrived** / **Undo**; edit/delete. Manual rows are kept when a sheet replaces uploaded rows.

### Exceptions
Type filters: **Negative stock**, **Missing supplier data**, **Stale demand**, **Conflicting rules**. Actions may include **Add pricing** or **Client review**. **Export CSV**. Empty: **All clear — no data exceptions detected.**

### Reference Data
Search; **Add Row**; inline edit of supplier–item fields (lead time, safety months, transit/bond/port/clearing, pallet/container, priority, costs, unit price, notes). Placeholder pricing may show **No quote on file** with **Add quote**.

### Users (Approvers)
Assign **Buyer** / **Approver** by email; change roles; **Set password** for existing sign-in accounts.

### Connector Health
Status: **Healthy**, **Degraded**, or **Offline**; last seen, uptime, last successful sync; **Recent Sync Runs** (Success / Failed / Partial). Banner: error log coming soon.

### Ask AI (feature, not a menu item)
**Inventory AI** chat overlay.

---

## 7. Page-by-Page Guide

### Sign in
**Purpose:** Authenticate.  
**Who:** Anyone with an account.  
**How:** Open the app URL when signed out.  
**Appears:** Email, password, Forgot password?, Sign in.  
**Actions:** Sign in; open forgot-password flow.

### Reset your password / Check your email (on login card)
**Purpose:** Request a reset email.  
**Actions:** Send reset link; Back to sign in.

### Set a new password
**Purpose:** Choose a new password from an email link.  
**Actions:** Set password; Back to login if invalid.

### Dashboard
**Purpose:** At-a-glance inventory intelligence.  
**Who:** All signed-in users.  
**How:** Sidebar **Dashboard**.

### Reorder
**Purpose:** Act on replenishment recommendations.  
**Who:** All.  
**How:** Sidebar **Reorder**.  
**Appears:** Tab bar; tables; filters/saved views; export; expand panels; Add to PO.  
**Notes:** Cart icon in top bar shows selected lines.

### Inventory
**Purpose:** Browse stock.  
**Who:** All.  
**How:** Sidebar **Inventory**.  
**Actions:** Search/filter; Export CSV.

### Purchase Orders (list)
**Purpose:** Manage drafts and workflow.  
**Who:** All.  
**How:** Sidebar **Purchase Orders**.  
**Appears:** Summary cards; status tabs; PO cards with actions; empty state “No purchase orders in this view”.  
**Approvers:** Default tab may open **Awaiting approval** when there are pending POs.

### Review cart and create POs
**Purpose:** Group cart by supplier and create POs.  
**Who:** All users with cart lines.  
**How:** From PO cart → **Review and create POs** (wording on cart CTA).  
**Appears:** Summary cards (Purchase orders, Items, Total quantity, Estimated total); supplier groups with readiness (**Ready for approval**, **Needs pricing**, **Supplier required**, **Invalid quantity**); per-group actions.  
**Actions:** Create and send for approval; Save as draft; Assign supplier; Fix quantity; edit unit price when missing; remove lines.

### Purchase Order (detail)
**Purpose:** View one PO, change status, download PDF, email supplier.  
**Who:** All (actions depend on status and role).  
**How:** Open a PO from the list.  
**Appears:** PO number, status badge, supplier, dates, order value, line table (SKU, Description, Vendor item #, Qty, Unit cost, Line total), transition buttons, download, mail.  
**Notes:** Cannot approve your own PO. Sent POs show **Completed** for transitions.

### Inbound Containers
**Purpose:** Track expected inbound stock.  
**Who:** All.  
**How:** Sidebar **Inbound Containers**.  
**Actions:** Upload sheet; add/edit; mark arrived; delete (with confirmations as shown).

### Exceptions (title: Data exceptions)
**Purpose:** Find data problems.  
**Who:** All.  
**How:** Sidebar **Exceptions**.  
**Actions:** Filter; Export CSV.

### Reference Data
**Purpose:** Maintain item–supplier reference information.  
**Who:** All.  
**How:** Sidebar **Reference Data**.  
**Actions:** Search; add; edit; delete; pagination.

### Users
**Purpose:** Assign roles and set passwords.  
**Who:** Approvers only.  
**How:** Sidebar **Users**.  
**Appears:** Add by email; table Email | Role | Password.  
**Actions:** Add user; change role; Set password (inline).  
**Notes:** Own role select disabled “(you)”. Does not create sign-in accounts—only assigns roles.

### Connector Health
**Purpose:** Monitor sync health.  
**Who:** All.  
**How:** Sidebar **Connector Health**.  
**Notes:** Detailed error log “coming soon”.

---

## 8. Step-by-Step Procedures

### A. Sign in
**Role:** Any · **Start:** Sign-in page  
1. Enter **Email address** and **Password**.  
2. Select **Sign in**.  
**Result:** Dashboard opens.

### B. Reset a forgotten password
**Role:** Any · **Start:** Sign in  
1. Select **Forgot password?**  
2. Enter email → **Send reset link**.  
3. Open email link → set new password (≥ 8, matching confirm) → **Set password**.  
4. Sign in with the new password.

### C. Change your own password
**Role:** Any · **Start:** Any signed-in page  
1. Open sidebar account menu.  
2. **Change password** → enter current and new passwords → **Update password**.  
**Result:** **Password updated.**

### D. Add items to the PO cart from Reorder
**Role:** Buyer or Approver · **Start:** Reorder → Reorder Action  
1. Review statuses (**Critical**, **Watch**, **Reorder Needed**, etc.).  
2. Select rows and use **Add selected to PO**, or expand a row and select **Add to PO**.  
3. If prompted that units already exist on platform POs, choose **Add anyway** or **Cancel**.  
**Result:** Messages such as **Added {SKU} to PO cart** or **Added N item(s) to PO cart**. Cart badge updates.

### D2. Override a locked vendor (Approver)
**Start:** Cart or review supplier field on a locked item  
1. Open supplier options. Buyers see a hint to ask an Approver if lower quotes exist.  
2. As Approver, select an alternate supplier → **Override lock**.  
3. Enter a required reason → **Confirm**.  
**Result:** **Lock overridden to {id}. Logged with reason.** (or error if reason missing / not Approver)

### E. Review cart and create purchase orders
**Role:** Buyer or Approver · **Prerequisites:** Cart has lines  
1. Open the cart from the top bar.  
2. Continue to **Review cart and create POs**.  
3. For each supplier group:  
   - If **Supplier required**: assign a supplier on each line.  
   - If **Invalid quantity**: fix quantity.  
   - If **Needs pricing**: enter unit price or **Save as draft**.  
   - If **Ready for approval**: **Save as draft** or **Create and send for approval**.  
**Result:** Success messages such as **{PO number} was created and sent for approval.** or **was saved as a draft.** with **View purchase order**. When all groups are done: **All purchase orders have been created.**

### F. Send an existing draft for approval
**Role:** Buyer or Approver · **Start:** Purchase Orders → open a **Draft**  
1. Select **Send for approval**.  
**Result:** Status becomes **Pending approval**; approvers can be notified.

### G. Approve a purchase order
**Role:** Approver (not the creator) · **Start:** Purchase Orders list or PO detail  
1. From the list, open a pending PO with **Review and approve** (or open the PO and use the detail toolbar).  
2. Select **Approve purchase order**.  
**Result:** Status **Approved**. Creator may see a notification such as **{PO number} approved by {email}**.  
**Blocked if:** You are the creator → **You cannot approve a purchase order you created**. Non-approvers → **Only approvers can approve purchase orders**. Buyers on the list see **View status** instead of approve.

### H. Return a PO to the buyer
**Role:** Approver · **Start:** Pending approval  
1. Select **Return to buyer**.  
2. Enter a comment (required). Placeholder: **Comment required**.  
3. Select **Confirm**.  
**Result:** Status **Draft** again. If the comment is missing: **A comment is required when returning a purchase order to the buyer.**

### I. Suppress a PO
**Role:** Users with the Suppress action available · **Start:** Draft or Pending approval (as allowed)  
1. Select **Suppress**.  
2. Enter a required note.  
**Result:** Status **Suppressed** (archived; can show via Show archive).

### J. Revive a suppressed PO
1. Show archive if needed.  
2. Open suppressed PO.  
3. Select **Revive as draft**.  
**Result:** Status **Draft**.

### K. Send / mark a PO as sent
**Role:** User with access to an **Approved** PO  
Two related actions exist:
1. From the list, **Send to supplier** (or on detail, the mail icon) opens **Send purchase order email?** — confirm with **Confirm send**. This emails the PO with PDF when a supplier email is on file.  
2. On detail, **Mark as sent** updates the status to **Sent** without using the email dialog.  

**If no supplier email:** use **Add supplier email** (opens Reference Data).  
**Result:** After email/send flow succeeds, status is **Sent**; further transitions show **Completed**.

### L. Download a PO PDF
1. Open the PO.  
2. Select the download control.  
**Result:** PDF downloads.

### M. Upload an inbound sheet
**Role:** Any · **Start:** Inbound Containers  
1. Select **Upload sheet** and choose an Excel **`.xlsx`** file.  
2. Confirm **Replace uploaded containers?** if prompted (manually added containers are kept).  
**Result:** **Uploading…** then **Parsing…**; success message such as loaded counts for the month, or an error banner.

### N. Assign a user role (Approver)
1. Open **Users**.  
2. Under **Add by email**, enter email, choose Buyer/Approver, **Add user**.  
**Notes:** Does not create a login—person must already be able to sign in.  
**If email already has a role:** message pointing to the table.

### O. Set another user’s password (Approver)
1. On **Users**, select **Set password** for the row.  
2. Enter a password (≥ 8 characters) → **Save**.  
**Result:** **Password set for {email}. Share it with them securely.**  
**If no sign-in account:** **No sign-in account exists for this email.** / **No sign-in account for this email yet.**

### P. Export a list
On Reorder / Inventory / Exceptions (where shown): select **Export CSV** and/or **Export PDF**.  
**Result:** File downloads (or Exporting… while working).

---

## 9. Forms and Fields

### Sign in

| Field shown to user | What to enter | Required? | Accepted format | Important notes |
| ------------------- | ------------- | --------- | --------------- | --------------- |
| Email address | Work email | Yes | Email | |
| Password | Account password | Yes | Text | Show/hide toggle |

### Forgot password

| Field | What to enter | Required? | Notes |
| ----- | ------------- | --------- | ----- |
| Email address | Account email | Yes | Neutral success message always |

### Set a new password / Change password

| Field | What to enter | Required? | Notes |
| ----- | ------------- | --------- | ----- |
| Current password | Existing password | Yes (change-password only) | Verified before update |
| New password | New secret | Yes | Min 8 characters |
| Confirm password | Same as new | Yes | Must match |

### PO review — quantity / unit price

| Field | What to enter | Required? | Notes |
| ----- | ------------- | --------- | ----- |
| Qty | Positive quantity | Yes for create | Invalid quantity blocks create |
| Unit price US$ | Decimal price | Needed for approval-ready | Inline when missing; line total shows Waiting for price until set |

### PO return / suppress note

| Field | What to enter | Required? | Notes |
| ----- | ------------- | --------- | ----- |
| Note | Reason text | Yes | Required for Return to buyer and Suppress |

### Users — add / set password

| Field | What to enter | Required? | Notes |
| ----- | ------------- | --------- | ----- |
| Email | User email | Yes | Role assignment only |
| Role | Buyer or Approver | Yes | Never marketing in UI |
| New password (set) | Temporary password | Yes | Min 8; share securely offline |

### Reference Data
Editable supplier–item fields include pricing, lead time, safety stock months, in-transit / bond / port / clearing quantities, pallet and container quantities, ordering and holding costs, priority vendor, and related reference attributes as shown on the form.  
**Requires confirmation from the system owner** for a complete field-by-field business glossary of every optional column.

### Inbound container form
Includes container details and dates (ETA may show as TBA). Exact field list **requires confirmation from the system owner** against the live Add/Edit modal labels.

---

## 10. Statuses and Workflows

### Reorder recommendation statuses

| Status | What it means | Who acts next | Typical actions |
| ------ | ------------- | ------------- | --------------- |
| Critical | Highest urgency | Buyer | Review and add to PO cart |
| Watch | Elevated attention | Buyer | Monitor / order as needed |
| Reorder Needed | Below reorder guidance | Buyer | Consider ordering |
| OK | Healthy | Buyer | Usually no order |
| No Demand | No recent demand | Buyer | Usually exclude from action |

### Purchase order statuses

| Status | What it means | Who takes the next action | Available actions | What happens next |
| ------ | ------------- | ------------------------- | ----------------- | ----------------- |
| Draft | Editable / returned / revived | Buyer (usually) | Send for approval; Suppress | Moves to Pending approval or Suppressed |
| Pending approval | Waiting on Approver | Approver | Approve; Return to buyer; Suppress | Approved, Draft, or Suppressed |
| Approved | Ready to send | Buyer/ops | Mark as sent; Email; PDF | Sent |
| Sent | Completed send | — | Completed (no further transitions) | Terminal for workflow |
| Suppressed | Archived / not proceeding | Approver/buyer as allowed | Revive as draft | Back to Draft |

### Purchase order process (user view)
1. Add lines from Reorder into the cart.  
2. Review by supplier; fix supplier, qty, pricing.  
3. Save as draft or create and send for approval.  
4. Approver approves or returns with a note.  
5. After approval, download PDF and/or email supplier; mark sent.  
6. Optional: suppress instead of proceeding.

**Self-approval:** Not allowed.  
**Return:** Requires a note; buyer corrects and can send again.  
**Reverse sent:** Not available in the UI (Sent is complete).

### Cart readiness (review screen)

| Readiness | Meaning | Actions shown |
| --------- | ------- | ------------- |
| Ready for approval | Supplier set, prices ok, qty valid | Save as draft; Create and send for approval |
| Needs pricing | Missing prices | Save as draft; enter prices |
| Supplier required / Unassigned | No supplier | Assign supplier |
| Invalid quantity | Qty not valid | Fix quantity |

---

## 11. Buttons and Actions

| Button or action | Where it appears | Who can use it | What it does | Important conditions |
| ---------------- | ---------------- | -------------- | ------------ | -------------------- |
| Sign in | Login | Anyone | Signs in | Valid credentials |
| Forgot password? | Login | Anyone | Opens reset request | |
| Send reset link | Login | Anyone | Emails reset link if account exists | Neutral confirmation |
| Set password | Update-password page | Recovery session | Sets new password | Min 8; matching confirm |
| Update password | Account menu | Signed-in user | Changes password | Current password must be correct |
| Sign out | Account menu | Signed-in user | Ends session | |
| Ask AI | Floating button | All | Opens AI chat | Review answers before use |
| Cart icon | Top bar | All | Opens PO cart | |
| Notifications bell | Top bar | All | Opens notifications | |
| Add to PO | Reorder detail | All | Adds SKU to cart | |
| Review and create POs | Cart | All | Opens review | |
| Create and send for approval | Review group | All (ready groups) | Creates PO + pending approval | Per supplier group |
| Save as draft | Review group | All (eligible) | Creates draft PO | |
| Send for approval | PO draft / list | All | Draft → Pending approval | |
| Review and approve | PO list (pending) | Approver (not creator) | Opens PO to approve | Buyers see View status |
| Approve purchase order | PO detail | Approver | Approves | Not own PO |
| Return to buyer | PO pending | Approver | Back to draft | Note required |
| Suppress / Suppress PO | PO | Allowed statuses | Archives | Note on detail; confirm list policy |
| Revive as draft | Suppressed PO | Allowed | Restores draft | |
| Send to supplier | PO list (approved) | All | Emails PO + PDF | Needs supplier email |
| Mark as sent | PO detail | All | Sets status Sent | Separate from email dialog |
| Download PDF | PO detail | All | Downloads PDF | |
| Send email (mail icon) | Approved PO | All | Emails supplier | Needs supplier email |
| Export CSV / Export PDF | List pages | All | Downloads file | |
| Upload sheet | Inbound | All | Imports sheet | Confirm dialog |
| Add user | Users | Approver | Assigns role | No auth account creation |
| Set password | Users row | Approver | Admin sets password | Auth account must exist |
| Assign supplier / Fix quantity | Review | All | Focuses fixes | |

---

## 12. Searching, Filtering, and Sorting

### Purchase Orders
- Tabs filter by status: All, Drafts, Awaiting approval, Approved, Sent.  
- **Show archive / Hide archive** toggles suppressed POs.  
- Empty view: **No purchase orders in this view**.

### Reorder
- Tabs: Reorder Action, Overstock, Non-Stock Items, Unclassified.  
- Filters and saved views on Action tab (apply view automatically option).  
- Sortable column headers on Action tables.  
- Data freshness badge shows last inventory sync age.

### Inventory
- Status filter options: **Critical**, **Reorder Needed**, **OK**, **No Activity** (table badges for that condition show **No Demand**).  
- **Watch** appears on Reorder and the Dashboard pie chart but is not an Inventory status filter option.  
- Class/Category filter; **Show inactive items**; search **Search SKU or name**; saved views; **Export CSV**.

### Exceptions / Reference Data
- Exceptions: type pills, search, sort by Severity or SKU, **Export CSV**.  
- Reference Data: search by SKU or product name; pagination; **Add Row**.

### Role limits on search
List visibility is not split by buyer vs approver for main operational lists; **Users** is approver-only.

---

## 13. Documents and File Uploads

### Inbound Containers — Upload sheet
1. Select **Upload sheet**.  
2. Choose an Excel **`.xlsx`** file and confirm when prompted (**Replace uploaded containers?**).  
3. Wait through **Uploading…** / **Parsing…**.  
4. Review success or error banner.

Maximum file size: **Requires confirmation from the system owner** (not shown as a visible limit in the UI).

### Purchase order PDF
- Download from PO detail (not an upload).  
- Email send attaches/sends the PO when configured.

### Other uploads
No general document library was confirmed outside inbound upload and PO PDF/email.

---

## 14. Notifications and Messages

### In-system notifications (bell)
Open **Notifications** → read items → **Mark all read** if needed. Confirmed title patterns:
- **{PO number} awaiting approval** (approvers; body may include submitter and total)
- **{PO number} approved by {email}** (creator)
- **{PO number} suppressed by {email}** (creator)

### Success examples (exact or patterned)
- If that email has an account, a reset link is on its way.  
- Password updated.  
- Password updated (account menu).  
- {PO} was created and sent for approval. / was saved as a draft.  
- All purchase orders have been created.  
- Added {SKU} to PO cart / Added N items to PO cart.  
- Status updated to {status}.  
- Password set for {email}. Share it with them securely.  
- Role assigned to {email}. / Updated {email} to {role}.

### Warning / info examples
- Waiting for price  
- N items need pricing / items are missing prices… can be saved as a draft but cannot be sent for approval  
- Estimated total unavailable (when nothing is priced)  
- Price not on file for N line(s)  
- Error log coming soon (Connector Health)

### Error / block examples
- Current password is incorrect.  
- This reset link has expired or is invalid…  
- Password must be at least 8 characters. / Passwords do not match.  
- Only approvers can approve purchase orders  
- You cannot approve a purchase order you created  
- You can't remove your own approver role.  
- At least one approver is required.  
- That email already has a role. Change it in the table below.  
- No sign-in account exists for this email.  
- Failed to send purchase order email / Transition failed (generic)

### Email notifications
- Password reset email (self-serve or as configured)  
- Purchase-order related emails when sending an approved PO to a supplier  
**Requires confirmation from the system owner** for exact email subject lines and recipients in production.

---

## 15. Reports and Exports

| Report / export | Purpose | Who | How | Formats |
| --------------- | ------- | --- | --- | ------- |
| Reorder Action export | Share action list | All | Export CSV / Export PDF on Reorder Action | CSV, PDF |
| Overstock export | Overstock list | All | Export CSV / PDF | CSV, PDF |
| Non-Stock / Unclassified | Those tabs | All | Export CSV | CSV |
| Inventory export | On-hand list | All | Export CSV | CSV |
| Exceptions export | Exception list | All | Export CSV | CSV |
| Purchase order PDF | Supplier/document copy | All | Download on PO detail | PDF |

When no data: empty states or empty files depending on the screen—verify on the page you are exporting.

Dashboard charts are on-screen analytics, not a separate downloadable report pack.

---

## 16. Administrative Tasks

Available through the UI to **Approvers** on **Users**:

| Task | Effect on others | Notes |
| ---- | ---------------- | ----- |
| Add user (assign role) | Grants Buyer/Approver capabilities | Does not create login |
| Change role | Changes what the person can approve/manage | Cannot self-demote; cannot remove last Approver |
| Set password | Changes their sign-in password | Share securely; no email of the password |

Not confirmed in UI:
- Deactivate user  
- Full audit viewer for password sets (logging exists behind the scenes; no end-user audit screen confirmed)  
- System-wide settings pages  

Mark any password or role change as high impact: tell the user what changed.

---

## 17. Automated or AI-Assisted Features

### Ask AI (**Inventory AI**)
- **What:** Chat assistant for inventory, suppliers, sales, and purchase orders.  
- **When:** When you need help interpreting stock or purchasing context.  
- **How:** Select floating **Ask AI**.  
- **Provide:** Your question, or pick a starter chip.  
- **Result:** Text answers (long chats may hit a length limit—use **New chat**).  
- **Review:** Always review before ordering or approving.  
- **Failure:** **Something went wrong. Please try again.**

### Reorder recommendations / AI Summary / Analysis
- Statuses and suggested quantities are decision support—adjust before **Add to PO**.  
- **Generate AI summary** builds a portfolio narrative for current filters.  
- Expanded **Analysis** / **Reorder explanation** explains an individual recommendation.  
- Sources may show **Generated by AI**, **Cached AI summary/explanation**, or **AI unavailable (template …)**.

### Seasonal Intelligence (Dashboard)
- **Refresh Analysis** scans sales history for category guidance.  
- Treat peaks and order windows as planning guidance, not automatic orders.

---

## 18. End-to-End User Scenarios

### Scenario 1 — Buyer creates and sends a PO for approval
**Goal:** Order critical stock.  
**Start:** Reorder → Reorder Action.  
1. Filter to Critical / Reorder Needed items.  
2. Add items to PO cart.  
3. Open cart → Review cart and create POs.  
4. Fix any supplier or pricing issues.  
5. Select **Create and send for approval** for ready suppliers.  
**Outcome:** POs in Pending approval; Approver can decide.

### Scenario 2 — Approver approves a PO
**Start:** Purchase Orders → Awaiting approval.  
1. Open the PO (not one you created).  
2. Review lines and value.  
3. **Approve purchase order**.  
**Outcome:** Approved; buyer can send/PDF.

### Scenario 3 — Approver returns a PO
1. Open pending PO.  
2. **Return to buyer** with a clear note.  
**Outcome:** Draft again; buyer fixes and resubmits.

### Scenario 4 — Buyer emails an approved PO
1. Open Approved PO.  
2. Ensure supplier email exists (else Add supplier email in Reference Data).  
3. Use mail action and confirm.  
**Outcome:** Sent.

### Scenario 5 — Approver onboards access for a colleague
1. Users → Add by email with role.  
2. If they already have a login, **Set password** and share it securely.  
3. Colleague signs in and changes password from the account menu.

### Scenario 6 — Upload inbound expectations
1. Inbound Containers → Upload sheet → confirm.  
2. Review parsed containers; mark arrived when stock lands.

---

## 19. Troubleshooting

| Problem | Possible reason | What the user should do |
| ------- | --------------- | ----------------------- |
| Cannot log in | Wrong password or no account | Use Forgot password?; ask Approver to set password; confirm email |
| Forgot password | — | Use Forgot password? on Sign in |
| Reset link invalid | Expired or opened wrongly | Request a new link |
| Users menu missing | Buyer role | Ask an Approver if you need that access |
| Redirected from Users | Not an Approver | Use other menus |
| Cannot approve | Buyer, or you created the PO | Ask another Approver |
| Approve button blocked | Self-approval rule | Have a different Approver approve |
| Cannot send for approval from review | Needs pricing / supplier / qty | Fix the readiness issues shown |
| Estimated total unavailable | No priced lines | Enter prices or use partial totals when some lines priced |
| Cart item stuck unassigned | No supplier | Assign supplier on the line |
| Vendor locked | Purchase rule | Ask Approver to override if appropriate |
| Cannot email PO | Missing supplier email | Add supplier email in Reference Data |
| Upload failed | File/format issue | Retry; try another file; ask support |
| Export empty | Filters exclude all rows | Clear filters; confirm tab |
| Notification missing | Timing or role targeting | Refresh; check with Approver |
| Session expired | Idle timeout | Sign in again |
| Button not visible | Status/role/conditions | Check PO status and your role |

---

## 20. Frequently Asked Questions

**Why can’t I edit this purchase order?**  
It may already be Pending approval, Approved, or Sent. Return/revive may be required first.

**Why can’t I see Approve?**  
You may be a Buyer, or you created the PO, or it is not Pending approval.

**Can I change a PO after submitting for approval?**  
Not while Pending approval unless an Approver returns it to Draft.

**What happens when I return a request?**  
It becomes Draft with your note; the buyer should correct and send again.

**How do I know submission worked?**  
Look for success banners (PO number created/sent) and the Pending approval status.

**Where are previous POs?**  
Purchase Orders list tabs and archive for suppressed.

**Does Add user create a login?**  
No. It only assigns a role to an email. Sign-in must already exist (or be created outside this screen).

**Who can view my PO?**  
Signed-in users of the organization workspace can open Purchase Orders; treat PO data as internal.

**How do I export?**  
Use Export CSV/PDF buttons on list screens that show them.

**What if I choose the wrong status action?**  
Use Return / Revive / Suppress only as the screen allows; Sent cannot be undone in the UI.

---

## 21. Glossary

| Term | Meaning |
| ---- | ------- |
| Inventory Intelligence | This application |
| Buyer | Role that prepares POs but does not approve |
| Approver | Role that can approve/return POs and manage Users |
| SKU | Stock keeping unit / item code |
| Reorder Action | Main tab of items needing replenishment attention |
| PO cart | Holding area for items before creating purchase orders |
| Draft | PO not yet awaiting approval (or returned) |
| Pending approval | Waiting for an Approver |
| Approved | Cleared for send |
| Sent | Marked/sent as complete |
| Suppressed | Archived / not proceeding |
| Critical / Watch / Reorder Needed / OK / No Demand | Reorder risk labels |
| Reference Data | Supplier–item master details used for pricing and planning |
| Exceptions | Data quality issues needing cleanup |
| Inbound Containers | Expected arriving stock shipments |
| Connector Health | Whether inventory sync looks healthy |
| Ask AI | In-app assistant chat |

---

## 22. Security and Good Practices

- Keep passwords private; do not share accounts.  
- Prefer changing a temporary Approver-set password after first sign-in.  
- Sign out on shared computers.  
- Double-check quantities, suppliers, and prices before Create and send for approval.  
- Approvers: never approve your own PO; read return notes carefully.  
- When setting passwords for others, share them through a secure channel—not a public chat.  
- Review AI answers before ordering or approving.  
- Upload only the correct inbound files.  
- Report unexpected access or suspicious activity to your system owner.

---

## 23. Items Requiring Confirmation

| Unclear item | Why unclear | Question for system owner | Manual section |
| ------------ | ----------- | ------------------------- | -------------- |
| How first auth accounts are created | Users screen does not create logins | How are new people first enrolled to sign in? | 3, 16 |
| MFA | Not seen in UI | Is MFA required? | 3 |
| Inbound upload max file size | `.xlsx` confirmed; size not labeled | What size limit should trainers publish? | 13 |
| Inventory **No Activity** vs badge **No Demand** | Same condition, different labels | Which wording should training standardize on? | 6, 12 |
| Full Reference Data field business definitions | Many planning fields | Provide business definitions for each column? | 9 |
| Email subject lines / recipient lists | Generated server-side | What do suppliers/users receive by email? | 14 |
| Mobile navigation differences | Desktop sidebar confirmed | Is there a separate mobile menu? | 4 |
| List **Send to supplier** vs detail **Mark as sent** | Two related paths | Which process should ops follow as standard? | 8, 10 |
| Whether list **Suppress PO** requires a reason | Detail Suppress can collect a note; list path differs | Confirm required reason policy | 10, 11 |
| Session timeout length | Not shown in UI | How long until auto sign-out? | 3, 19 |
| Production URL users should bookmark | Environment-specific | What is the official URL? | 3 |
| Whether other roles (e.g. marketing) can sign in | Not offered in Users UI | Do any non-buyer/approver roles exist in production? | 2 |

---

## 24. Screenshot Plan

| Screenshot | Screen | What it should show | Suggested caption | Role | Hide / highlight |
| ---------- | ------ | ------------------- | ----------------- | ---- | ---------------- |
| 1 | Sign in | Branding, email, password, Forgot password? | Sign in to Inventory Intelligence | — | No real passwords |
| 2 | Forgot password | Reset form + confirmation text | Requesting a password reset | — | Mask email if needed |
| 3 | Set a new password | New/confirm fields | Choosing a new password from email link | — | |
| 4 | Dashboard | Metric cards + charts | Dashboard overview | Buyer | Mask sensitive values if required |
| 5 | Sidebar | Full menu including Users for Approver | Main navigation | Approver | Highlight Users |
| 6 | Account menu | Email, role, Change password, Sign out | Your account menu | Buyer | |
| 7 | Reorder Action | Status badges + Add to PO | Working a reorder recommendation | Buyer | Highlight Add to PO |
| 8 | PO cart | Grouped lines + review CTA | Purchase order cart | Buyer | |
| 9 | Review cart | Ready vs Needs pricing groups | Review before creating POs | Buyer | Highlight Create and send |
| 10 | PO list | Tabs + summary cards | Purchase Orders list | Approver | Highlight Awaiting approval |
| 11 | PO detail approve | Approve + Return | Approving a purchase order | Approver | Highlight Approve |
| 12 | Return note | Note field | Returning a PO to the buyer | Approver | |
| 13 | Users | Add by email + Set password | Managing users | Approver | Mask emails if needed |
| 14 | Inbound upload | Upload sheet control | Uploading an inbound sheet | Buyer | |
| 15 | Notifications | Bell open with items | In-app notifications | Approver | |
| 16 | Ask AI | Open chat | Asking the AI assistant | Buyer | Do not show confidential prompts |
| 17 | Success banner | PO created message | Confirmation after creating a PO | Buyer | |
| 18 | Error | Self-approve or incorrect password | Example of a blocked action | — | |

---

## 25. Suggested Training Manual Contents

### General user training (Buyers and Approvers)
1. About the system and signing in  
2. Navigation, account menu, notifications, Ask AI  
3. Dashboard overview  
4. Reorder → cart → review → draft/submit  
5. Inventory, Exceptions, Reference Data basics  
6. Inbound Containers upload  
7. Connector Health at a glance  
8. Password reset and change password  
9. Troubleshooting and FAQ  

### Approver training (add-on)
1. Approving and returning POs (including self-approval rule)  
2. Suppress / revive  
3. Vendor lock override when changing suppliers on locked items  
4. Users: assign roles and set passwords  
5. Watching Awaiting approval and notifications  

### Administrator training
Within this product, “administrator” work is primarily the **Approver** Users screen plus operational ownership of Reference Data and Connector Health.  
**Requires confirmation from the system owner** if a separate IT admin process exists outside the app.

### Recommended learning order for a new Buyer
Sign in → Dashboard → Reorder Action → Add to PO → Review → Save draft → Send for approval → Find PO on list → PDF.

### Recommended learning order for a new Approver
Buyer path first → Approve/Return → Users role assignment → Set password securely.

---

## Final review checklist (author)

1. Visible pages covered: Sign in, Update password, Dashboard, Reorder, Inventory, Purchase Orders (list/detail/review), Inbound Containers, Exceptions, Reference Data, Users, Connector Health.  
2. Menu items covered including approver-only Users.  
3. Major forms covered: login, reset, passwords, review pricing/qty, PO notes, Users.  
4. Major buttons explained in §11.  
5. Roles Buyer/Approver covered.  
6. PO and reorder statuses covered.  
7. Main workflows in §8 and §18.  
8. Validation messages included where confirmed.  
9. Notifications described at feature level; exact titles flagged where dynamic.  
10. No backend/table/API/file-path content in the user-facing sections.  
11. No secrets included.  
12. No application code was modified for this document.
