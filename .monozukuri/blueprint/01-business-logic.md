# Business logic — Studiskarte Marketplace

Revision 2. Rewritten from the owner's feature list. Earlier revisions are approved up to the `.edu.ph` rule, code verification, alerts, 30-day sessions and no offline use. Everything new in this revision awaits approval.

## Overview
"The marketplace where student hustle meets student needs." A board for verified students in the Philippines, used as an installable app on a phone (a PWA).

- A student posts what they offer (a **Showcase**) or what they are looking for (a **Wishlist** item), always with photos, a price, and a meet-up plan.
- Other students browse a feed, filter and search it, heart posts, follow people, message, and make offers.
- An accepted offer becomes a **Deal**: the two students agree a time and place, meet, hand over the item, and confirm. Completed deals produce items-sold, items-granted and items-bought counts, and let both sides leave a review.
- **The system never handles money.** Payment happens in person. (Decided: no payments. "Buy now" is a reserve, see Offers.)
- The app needs a connection. Nothing works offline. (Decided.)
- Reports and blocks keep students safe.

Societies (group chat), Events, and AI listing tools are recorded at the end as later work. They are deliberately incomplete. (Decided: record now, build last.)

## Actors and roles
- **Visitor**: not signed in or not verified. Sees only the landing page, sign-in, and the legal pages. [Assumed.]
- **Student**: a verified user. Can do everything in this document except admin actions.
- **Seller** (role of a Student, per deal): the one who gives the item. That is the owner of a Showcase, or the responder who supplies a Wishlist item.
- **Buyer** (role of a Student, per deal): the one who receives the item. That is the owner of a Wishlist item, or the responder to a Showcase.
- A Student is buyer in one deal and seller in another. Roles come from the post and the deal, not from the account. (Decided.)
- **Follower**: a Student who follows another Student.
- **Admin**: reviews the report queue, restores or removes hidden posts, and can suspend students. [Assumed: only the project owner at first. The owner said there is no team.]
- **Society, Event organizer**: later. See the end.

## Domains
- **Identity and verification**: who counts as a student, sign-in, sessions, account deletion.
- **Profile and social**: public profile, handle, followers, hearts, ratings.
- **Posts**: Showcase and Wishlist content.
- **Discovery**: the feed, filters, sorting, search.
- **Messaging**: private conversations about one post, with pictures.
- **Offers and deals**: offers, reserving, scheduling, handover, completion, reviews.
- **Notifications**: device alerts and the in-app notification list.
- **Calendar**: meet-up reminders and calendar export.
- **Safety**: reports, blocks, admin action.
- **Legal**: terms of service, privacy policy, community guidelines.

## Entities and relationships
- **Student**: a verified person. Attributes: unique handle (like an Instagram handle), display name, profile picture, school email, school (from the email domain), verification status, account status (active, suspended, deleted), the time they accepted the legal terms and which version.
- **Post** (kind **Showcase** or **Wishlist**): attributes: one to many photos (at least one), title, price (an amount, "free", or "negotiable"), description, category, condition (only where the category asks for one), exchange options (meet-up, delivery, or both), meet-up location (when meet-up is offered), delivery area (when delivery is offered), availability (days of the week, or specific dates, each with a time range), status, listed date, expiry date (30 days after it was listed), and view count. For a Wishlist, the price is what the poster is willing to pay, the condition is the condition wanted, and the exchange options say how the poster would like to receive the item. [Assumed from the owner's list: the same required fields apply to both kinds.]
- **Category**: one level (owner, 2026-10-16: no subcategories). A post chooses one category. Each category says whether its posts need a condition. The list is below.
- **Condition**: one value from a fixed list: new, used like new, used good, used fair. Needed only for categories that ask for it. [Assumed, following Facebook.]
- **School**: identified by the school's email domain, such as `up.edu.ph`. It has a readable name. Until the admin sets one, the domain is shown as the name. [Assumed.]
- **Heart**: a student's saved mark on a post.
- **Post view**: a record that a student opened a post on a given day. It is used only to count views.
- **Follow**: one student following another.
- **Conversation**: a thread between exactly two students about exactly one post. Shows the post as a product card at the top.
- **Message**: sender, text, optional pictures, sent time.
- **Offer**: made by the responder on a post. Attributes: amount, status, whether it is a reserve at the asking price, created time.
- **Deal**: created when the post owner accepts an offer. Attributes: the post, the two students, the agreed amount, handover method (meet-up or delivery), agreed time and place, status.
- **Review**: written by one deal participant about the other after the deal completes. Attributes: rating 1 to 5, optional text.
- **Notification**: an entry in a student's in-app list. Attributes: recipient, type, the thing it is about, read or unread, time.
- **Notification subscription**: a device a student has allowed to receive alerts.
- **Verification code**, **Session**: as in the earlier revisions.
- **Report**: a student's report of a post or another student. Attributes: reporter, target, reason, status, handler.
- **Block**: one student blocking another.
- **Calendar feed link**: a private, revocable link that lists a student's scheduled deals for calendar apps.
- A Student owns many posts. A post has many photos, many conversations (at most one per responder), many offers, and at most one active deal. A conversation has many messages. A deal has up to two reviews.

## Business rules

### Identity, sessions, accounts
- Only verified students may post, browse, message, offer, or follow.
- A person is verified only by proving they can receive mail at a school email address ending in `.edu.ph`. The domain is compared case-insensitively and must end exactly with `.edu.ph`, so `x.edu.ph.com`, `xedu.ph`, and `edu.ph` alone are not accepted. Subdomains such as `student.school.edu.ph` are accepted. (Decided.)
- Typing an address is not proof. Verification completes only when the person enters the code sent to that address. (Decided.)
- A code works once, only for the address it was sent to, and only for a limited time. A new request cancels the earlier code. Too many wrong entries lock it. [Assumed. Length, lifetime and attempt limit are open.]
- One school email address belongs to at most one student account.
- The system limits how many codes it sends to one address, and how many requests it accepts from one visitor, in a period. [Assumed. Limits open.]
- A signed-in student stays signed in on that device for 30 days. Signing out, suspension, or revoked verification ends it sooner. (Decided.)
- At first verification a student chooses a unique handle and a display name, and accepts the terms of service and privacy policy. The acceptance time and version are recorded. [Assumed.]
- A handle is unique, compared case-insensitively. It is 3 to 20 characters of a-z, 0-9, dot and underscore, does not start or end with a dot, and has no two dots in a row. It is stored lowercase. A student can change it at most once every 30 days; the first choice at sign-up does not count. A released handle becomes free for others. (Decided 2026-10-16.)
- A display name is 1 to 40 characters, any letters including ñ and emoji, trimmed, with no line breaks. It can be changed at any time. (Decided 2026-10-16.)
- The "verified student" check mark on a profile means the student proved a `.edu.ph` address. Every student has it. [Open: it carries no extra information until a second verification level exists.]
- A student's school email address is never shown to other students. [Assumed.]
- A student can delete their account. Deletion is final.

### Posts
- Each photo may have its own short description (up to 300 characters), shown under it. The post's main description is always required. (Owner, 2026-10-16.)
- A post needs: at least one photo, a title, a price statement, a description, a category, a condition (only where its category asks for one), at least one exchange option, at least one availability window, and the place that goes with each exchange option chosen (a meet-up location for meet-up, a delivery area for delivery). [Assumed from the owner's create list.]
- **Availability** is given either as days of the week (for example every Monday and Wednesday) or as specific dates picked on a calendar. Each day or date has a time range, the same for all or different per day. Dates are today or later, up to 60 days ahead; at most 14 entries. (Decided 2026-10-16.)
- The price statement is an amount in whole Philippine pesos from ₱1 to ₱1,000,000, or "free", or "negotiable". "Free" is a distinct value, not zero. (Decided 2026-10-16.)
- The exchange option is how the two students will exchange the item: **meet-up** (both go to the post's meet-up location) or **delivery** (the seller brings the item to the buyer, or sends it with a delivery app such as Grab or Lalamove, within the post's delivery area). A post can offer one or both. (Decided by the owner.) Delivery is arranged between the students: the app books no courier and handles no fee; any delivery cost is agreed between them. (Decided 2026-10-16.)
- "Scheduled pickups" in the owner's notification list means scheduled deliveries. There is no separate pickup method. (Decided: delivery or meet-up only.)
- Only the owner may edit, withdraw, or relist a post. Editing is allowed while the post is open.
- **Listings expire 30 days after they are listed**, like Facebook Marketplace. An expired post leaves the feed and search. To bring it back, the owner **relists** it. Relisting sets a new 30-day period and a new listed date, so it appears as new in the feed. (Decided by the owner.)
- The owner is told 3 days before a post expires, and when it does. [Assumed.]
- Relisting keeps the post's photos, details, and history. The owner may change them. A student can relist only their own expired posts. A withdrawn, fulfilled, or removed post cannot be relisted. [Assumed.]
- A reserved post does not expire while its deal is active. If the deal is cancelled, the post returns to open with at least 7 days left. [Assumed.]
- A relisted post counts against the limit of open posts, like any other.
- A post's view count goes up by one when a signed-in student other than the owner opens it, at most once per student per day. Only the owner sees the view count, hearts, messages and offers on the post, and never who viewed it. [Assumed.] (Decided: clicks on listings are counted.)
- **Services** (tutoring, printing, commissions, errands and similar) are posts like any other. They ask for no condition. Their exchange options mean: **meet-up** is doing the work in person at the post's location, and **delivery** is handing over the finished work, in person or online. A deal for a service completes when both students confirm the work was done. The system never moves money for services either. (Decided: services are in the first release.)
- Showcase and Wishlist are separate kinds, shown with a type label. A post's kind never changes. They do not match each other automatically. (Decided: independent boards.)
- A student can have at most 20 open posts, and a post has 1 to 10 photos. (Decided 2026-10-16.)
- Only open posts and reserved posts appear in the feed and search. An expired post does not. A reserved post is labelled reserved and cannot receive new offers.
- Posts from a student whom the viewer has blocked, or who blocked the viewer, are never shown to that viewer.
- Posts from students of every school are visible to every student. The school is shown on each post and can be filtered. (Decided by the owner's filter list.)

### Discovery
- The feed shows posts of both kinds. By default, posts from students the viewer follows come first, newest first. Posts from everyone else follow, newest first. A viewer who follows nobody sees everyone's posts newest first. (Decided by the owner.) When the viewer picks another sort, or searches, followed students are not put first. [Assumed.]
- The filters are: school, category, type of post, price range, condition, date listed, and sort. Sorting options are newest first, price high to low, and price low to high.
- Filters combine: a post must match all selected filters.
- Search covers posts, people, and schools. People are found by handle or display name. Search never shows closed posts, suspended students, or blocked students.
- Share creates a link to a post. A signed-out visitor who opens it is sent to sign-in and then to the post. The post's content is not visible before sign-in. [Assumed.]

### Profile and social
- A public profile shows: profile picture, handle, display name, verified mark, school, follower count, average rating as stars with the review count, "typically replies within" time, items sold, items granted, active listings, and reviews.
- A student's own profile adds: hearted posts, items bought, items sold, and the settings and legal pages.
- A student cannot follow themselves. Following is public. Hearts are private to the student who made them. The owner of a post sees that it got a heart, but not who gave it. [Assumed.]
- Items sold, items granted, and items bought are counted from completed deals only. A completed deal with a price counts as sold for the seller and bought for the buyer. A completed free deal counts as granted for the seller.
- The average rating comes only from reviews of completed deals. A student with no reviews shows no rating.
- **Typically replies within**: the typical time this student takes to reply to the first message of a conversation that someone else started with them, over the last 30 days. It is shown as one of: within an hour, within a few hours, within a day, within a few days. A conversation never answered after 3 days counts as "a few days". It is shown only when the student had at least 5 such conversations in that period. It appears on the profile and at the top of a conversation. [Assumed. The numbers are open.] (Decided: typical reply time on the profile.)
- A post's detail page shows the poster's star rating and review count, and links to their reviews. [Assumed.]

### Messaging
- A student cannot message their own post. A conversation is private to its two participants.
- A message can include pictures. Pictures are visible only to the two participants.
- Existing conversations on a post that is closed, withdrawn, expired, or hidden stay readable but accept no new messages. If the owner relists the post, they accept messages again. [Assumed.]
- A student cannot message someone they have blocked, or who blocked them. An existing conversation becomes read-only.

### Offers and deals
- Offers are made by the responder, never by the owner. For a Showcase the responder is the buyer, and for a Wishlist item the responder is the seller offering to supply it. The post owner accepts or declines.
- **Make offer**: the responder proposes an amount.
- **Reserve** (the "buy now" button): an offer at the post's stated price. It is available only when the post has a price amount, not for "negotiable". When the owner accepts, the item is reserved and handed over in person. No money moves in the system.
- A responder has at most one pending offer on a post at a time. They can withdraw it.
- A pending offer expires after a limited time. [Assumed. Duration open.]
- Accepting an offer creates a Deal, reserves the post, and declines all other pending offers on that post. Only one deal can be active on a post at a time.
- After acceptance the two students agree the handover: the responder proposes a time inside the post's availability, and the owner confirms or suggests another. [Assumed.] The deal is "scheduled" once both agree a time and place.
- Either participant can cancel a deal before it completes. The post then returns to open. [Assumed.]
- A deal completes when both participants confirm the handover. Completion is final. The post becomes fulfilled.
- A handover needs both students to confirm. If one has confirmed and the other has not, the other is reminded 1 day and 3 days after the scheduled time. Nobody else, including the admin, confirms for them. (Decided: the students confirm.) [Assumed: reminder times.]
- A deal that is not scheduled within 7 days of being accepted, or not completed within 7 days after its scheduled time, is cancelled automatically. The post returns to open with at least 7 days left, and both students are told. No counts or reviews result from it. [Assumed: both 7-day periods.] This keeps an item from staying reserved forever.
- After completion, each participant may review the other once. A review has a rating from 1 to 5 and optional text. A review cannot be edited or deleted by its author. [Assumed. Edit window open.]
- After a deal completes, both students get a reminder to review it, 1 day later. [Assumed.]
- The system never moves money. Amounts are agreements between the students. (Decided.)

### Notifications and calendar
- The in-app list records: new messages, offers and their outcomes, hearts and other activity on the student's own Showcase posts, the same for their own Wishlist posts, scheduled deliveries and scheduled meet-ups, changes to a deal (scheduled, confirmed, cancelled), and notices that one of the student's posts was hidden, restored, or removed. (Decided: activity on my own posts, no match alerts. Events are later.)
- The list also records: a post that will expire soon, a post that has expired, and a reminder to review a completed deal.
- The list also records: a reminder to confirm a handover, and a deal cancelled for inactivity.
- Device alerts (Web Push) are sent for the same entries when the student has alerts on. The sender of an action is never alerted about their own action.
- An alert shows only that something happened, with the post's title. It never shows message text. [Assumed.]
- A student can turn alerts on or off for each device. Signing out removes that device's subscription.
- A student without working alerts still sees everything in the app, with an unread count. Alerts are never the only way to learn of something.
- A student whose verification is revoked, or who is suspended, receives no alerts.
- A scheduled deal produces reminders before the meeting. [Assumed: one day and one hour before.]
- Each scheduled deal can be added to a calendar as a calendar file. Each student also has a private feed link that Google Calendar and iPhone Calendar can subscribe to. (Decided.) The feed lists only that student's scheduled deals, with the post title, time, and place. The student can regenerate the link, which stops the old one working.
- A lock-screen live calendar is not part of this product. A reminder alert takes its place. (Decided.)

### Safety
- Any student can report a post or a student, once per target, with a reason. Reports go to the admin queue.
- **A post reported by 3 different students is hidden at once**, and the post's owner is told it is hidden pending review. Only reports from verified, active students count. [Assumed: the number 3 is open.] This protects students when no one is available to review. (Decided: auto-hide after distinct reports.)
- The admin reviews the queue. For a hidden post the admin either restores it to the status it had before, or removes it for good. For a report about a student the admin dismisses it or suspends the student. A suspended student cannot sign in. Students are never suspended automatically. [Assumed.]
- When the admin restores a post, the reports made before that decision are cleared, so three new reports are needed to hide it again. [Assumed.]
- A hidden post leaves the feed and search, and takes no new offers or messages. An existing deal on it can still complete or be cancelled. If the admin removes the post, the deal is cancelled. [Assumed.]
- Any student can block another. Blocking is private. Neither side can see the other's posts, profile, or search results, or message each other. [Assumed.]
- A student cannot report or block themselves.

### Legal
- The terms of service, privacy policy, and community guidelines are readable by anyone, signed in or not.

### Limits of the product
- The system works only while connected. It never stores private data on the device for offline use.
- No payment, escrow, delivery courier, or fee is handled.

## Primary flows
1. **Verify**: Visitor enters a school email address -> rejected if it does not end in `.edu.ph` -> the system sends a code -> the Visitor enters it -> on first verification the Visitor chooses a handle and display name and accepts the terms -> signed in.
2. **Create a post**: Student chooses Showcase or Wishlist -> adds photos, title, price, description, category, condition, exchange options (meet-up, delivery, or both) with the matching place, and availability -> the system validates -> the post is open and appears in the feed.
3. **Browse**: Student opens the feed (followed students first, then everyone) -> applies filters and a sort -> scrolls -> opens a post to see photos (full screen, swipe), details, the poster's handle and stars. Opening the post counts a view.
4. **Search**: Student searches -> chooses posts, people, or schools -> opens a result.
5. **Heart and share**: Student hearts a post (private), or shares its link.
6. **Message**: Student opens a post that is not their own -> messages the owner, with text and pictures -> both reply.
7. **Offer**: Responder makes an offer, or reserves at the asking price -> the owner accepts or declines -> on accept a Deal is created and the post is reserved.
8. **Schedule and meet**: The two students agree a time and place -> both are reminded -> they meet and hand over the item -> both confirm -> the deal completes.
9. **Review**: After completion each participant rates the other and may write a review.
10. **Follow**: Student opens a profile -> follows or unfollows.
11. **Manage my posts**: Owner edits or withdraws a post, sees its views, hearts, messages and offers, and relists a post that has expired.
12. **Notifications**: Student opens the list, sees entries by type, and opens one. Reads it.
13. **Alerts**: Student turns alerts on or off for this device.
14. **Calendar**: Student adds a scheduled deal to their calendar, or copies their feed link into a calendar app.
15. **Report or block**: Student reports a post or student, or blocks a student from the post, profile, or conversation.
16. **Admin review**: Admin opens the queue -> sees auto-hidden posts and reports -> restores or removes a hidden post, or dismisses a report, or suspends a student.
17. **Edit profile**: Student changes profile picture, display name, and other editable settings.
18. **Delete my account**: Student confirms -> the profile and school email are erased, open posts are withdrawn, active deals are cancelled, conversations become read-only for the other participant -> the student is signed out everywhere.

## State transitions
- **Student**: unverified --school email confirmed--> verified; verified --verification revoked--> unverified; verified --admin suspends--> suspended; suspended --admin restores--> verified; verified --student deletes account--> deleted (final).
- **Post**: open --offer accepted--> reserved; reserved --deal cancelled--> open; reserved --deal completes--> fulfilled; open --owner withdraws--> withdrawn; open --30 days pass--> expired; expired --owner relists--> open (new 30 days); open or reserved --third distinct report, or admin hides--> hidden; hidden --admin restores--> the status it had before; hidden --admin removes--> removed. Fulfilled, withdrawn, and removed are final. A reserved post does not expire.
- **Offer**: pending --owner accepts--> accepted; pending --owner declines--> declined; pending --responder withdraws--> withdrawn; pending --time passes or the post expires--> expired; pending --another offer accepted--> declined.
- **Deal**: agreed --time and place agreed--> scheduled; agreed --7 days without a schedule--> cancelled; scheduled --7 days after the scheduled time without both confirming--> cancelled; agreed or scheduled --either cancels--> cancelled; scheduled --both confirm handover--> completed. Completed and cancelled are final.
- **Conversation**: active --post closes, expires, or is hidden, or a block is made--> read-only; read-only --owner relists the post--> active (unless blocked).
- **Report**: open --admin dismisses--> dismissed; open --admin acts--> actioned. Reports about a post that was auto-hidden stay open until the admin decides.
- **Verification code**, **Notification subscription**, **Session**: as in earlier revisions. Code: pending -> used, expired, cancelled, locked. Subscription: active -> removed. Session: active -> expired or ended.
- **Notification**: unread --student opens it--> read.

## Invariants
- Every post has exactly one owner, at least one photo, and a kind that never changes.
- Every conversation has exactly two distinct participants and exactly one post, and at most one conversation exists per (post, responder).
- A student has at most one pending offer per post, and never offers on their own post.
- At most one active deal exists per post. A deal's two participants are the post owner and the responder of the accepted offer, and they are distinct.
- A deal completes only after both participants confirm.
- A review exists only for a completed deal, at most one per reviewer per deal, with a rating from 1 to 5. The reviewer and reviewee are the deal's two participants.
- A handle is unique. A school email is unique. At most one follow exists per pair, never to oneself. At most one heart exists per (student, post). At most one block exists per pair, never to oneself. At most one report exists per (reporter, target).
- A verification code is used at most once, and only for the address it was sent to. At most one pending code exists per address.
- A notification subscription belongs to exactly one student, and only to a verified, active one.
- A session belongs to one verified student and one device, and ends within 30 days.
- Items sold, granted, bought, and ratings are derived from completed deals and reviews. They are never entered directly.
- An open post always has an expiry date that is still in the future. A post whose expiry date has passed is not open.
- Views are counted at most once per student per post per day, and never for the owner.

## Edge cases
- An address already used by another account -> rejected, with a pointer to sign in.
- A wrong, expired, used, cancelled, or locked code -> the same rejection message, with attempts left shown. [Assumed.]
- A request for a non-`.edu.ph` address -> no mail is sent, and the reply is the same as for any request. The form hints that a school `.edu.ph` address is needed.
- Repeated code requests -> refused with "try again later", and no mail sent.
- A handle already taken -> rejected, and the person chooses another.
- A post with no photo, or with a zero or negative amount -> rejected.
- A photo upload fails midway -> the post is not created, and the student keeps what they typed. [Assumed.]
- An offer on a reserved, closed, hidden, or own post -> rejected, with a reason.
- Two offers accepted at the same moment -> exactly one wins, and the other is declined.
- A responder makes an offer on a post that is withdrawn in the meantime -> the offer is rejected, with a reason.
- The owner changes the price while an offer is pending -> the offer keeps its own amount.
- A Reserve on a "negotiable" post -> not available. The responder must make an offer.
- A deal's meet-up time falls outside the post's availability -> rejected, unless the owner confirms it. [Assumed.]
- Only one participant confirms the handover and the other never does -> the other is reminded at 1 and 3 days. After 7 days the deal is cancelled, with no counts or reviews, and the post returns to open. [Assumed.]
- A participant deletes their account during an active deal -> the deal is cancelled, the other participant is told, and the post returns to open if the owner remains.
- A deleted student appears in old reviews and messages as "deleted student", with no handle or email. [Assumed.]
- A block is made during a scheduled deal -> the deal is cancelled and the post returns to open. [Assumed.]
- A report about a post whose owner is the reporter -> rejected.
- Three reports on a post come from three accounts that one person controls -> the post is hidden. It takes three real school email addresses, and the admin restores it in review. Not prevented, only made costly. [Assumed.]
- A post is hidden while it has an accepted deal -> the deal continues. If the admin removes the post, the deal is cancelled and both students are told.
- A post offers delivery only, and the buyer cannot be reached in the delivery area -> the buyer does not offer, or declines the deal. The system does not check addresses.
- A deal's chosen handover method is one the post does not offer -> rejected.
- A hearted post becomes closed, hidden, or deleted -> it stays in the hearted list, shown as unavailable.
- A shared link is opened signed out -> sign-in, then the post. A link to a closed or hidden post shows "no longer available".
- A calendar feed link is shared with someone else -> they see that student's scheduled deals until the student regenerates the link.
- The device is offline when the student opens the app -> the student sees a plain page saying a connection is needed. That page is the only thing stored on the device, and it holds nothing private. No boards, conversations, or other pages are stored or shown. (Decided: a static offline page.)
- A student signs out on a shared phone -> their alert subscription is removed and no earlier conversation is left visible.
- A session expires -> the student asks for a new code, and nothing stored on the server is lost.
- An alert subscription expires -> it is removed, and the notification waits in the app.
- A student on an iPhone has not installed the app -> alerts are unavailable. The student is told how to enable them, and still sees everything in the app.
- A student's verification is revoked while they own open posts -> the posts are hidden from the feed, and their conversations become read-only. They return if verification is restored. [Assumed.]
- Mixed case or spaces in an address -> treated as the normalized address.
- Two students message the same post at the same moment -> each gets their own conversation.
- A message to a post closed in the meantime -> rejected, with a reason.
- Duplicate post (same owner, kind, title and description, while open) -> rejected. [Assumed.]
- A post expires while a student is writing a message or an offer -> rejected, with a reason. The owner can relist it.
- An owner relists a post -> its conversations accept messages again. Offers that expired stay expired, and the responder can offer again.
- A reserved post reaches 30 days with an active deal -> it does not expire. If the deal is cancelled, it returns to open with at least 7 days left.
- A student relists many posts -> each counts against the open post limit.
- A student opens the same post many times in a day -> one view. The owner's own views do not count.
- A student has fewer than 5 qualifying conversations in 30 days -> no reply time is shown.
- A student blocks someone they follow, or who follows them -> both follows are removed. [Assumed.]
- A followed student deletes their account -> the follow is removed.
- A student follows nobody -> the feed is simply newest first.
- A post in a category that does not need a condition (for example Services) -> the form does not ask for one.
- A service is completed with no physical item -> both students confirm the work was done, and counts and reviews work as usual.
- A category is renamed or removed while posts use it -> existing posts keep their category. A relisting owner must choose a current one. [Assumed.]
- Abusive or illegal content -> reported, reviewed by the admin.

## Categories (confirmed by the owner 2026-10-16; one level, no subcategories)
A post chooses one category. Categories marked "no condition" do not ask for a condition. Wishlist posts use the same list. The owner's examples describe what each holds.

- **Textbooks & Study Materials**: books, reviewers, notes, reference materials.
- **School & Office Supplies**: notebooks, pens, art materials, printing supplies.
- **Uniforms & Org Merch**: school uniforms, org shirts, event merchandise.
- **Electronics & Gadgets**: calculators, chargers, headphones, computer accessories.
- **Dorm & Living Essentials**: storage, bedding, lamps, small appliances.
- **Clothing & Accessories**: thrift clothes, shoes, bags, jewelry.
- **Hobbies & Entertainment**: sports gear, instruments, games, collectibles.
- **Transportation**: bikes, bike accessories, transport-related needs.
- **Housing & Bedspace** (no condition): dorms, rooms, bedspaces, roommates.
- **Food & Treats** (no condition): snacks, meals, baked goods, desserts, drinks.
- **Services** (no condition): tutoring, graphic design, programming, photography, repairs.
- **Other** (no condition): items or services that fit nowhere else.

## Later work (recorded, not designed)
These are large separate systems. Each gets its own questions when its phase starts. They must not weaken the rules above. In particular, a Conversation stays a thread between exactly two students.

- **Societies**: group chats, like for a student organization. Open: what a society is (official school organization or any student group), who creates it, how members join, and how it is moderated. Because the admin is the owner alone, moderating group chats may be unworkable without more people.
- **Events**: events appear in the notification list and the calendar. Open: who posts events, whether they are campus events or student-run, and whether they are tied to societies.
- **AI listing**: from photos the system fills in title, description, category, and condition. It also suggests a price, and lists several items in one go from one photo (for example a whole room). Open: which provider, cost, whether students' photos may be sent to a third party under the privacy policy, and how accurate Philippine pricing suggestions can be. A student always reviews the result before posting.

## Open questions
- **Verified student vs staff**: `.edu.ph` also belongs to faculty and staff. Assumed: accept.
- **Re-verification**: when does verification end? Assumed: never in the first phases.
- Limits: open posts per student, photos per post and per message, photo size, handle format, display name rules, code length and lifetime and attempts, offer lifetime, review edit window, reminder times, the number of conversations needed to show a reply time, the expiry warning time.
- Retention: how long expired posts and their photos are kept. Assumed: indefinitely. Storage may need cleanup later.
- Services are in the first release. Paying a stranger for work has no protection, because the system never moves money. The community guidelines should say so. The owner supplies the text.
- Prohibited items and cheating: past exams, answer keys, school IDs, medicine, and similar must be named in the community guidelines. Not designed here. The owner supplies the text.
- Food and housing listings carry food safety and rental-fraud risk. The owner kept both categories (2026-10-16); the community guidelines must cover them before launch.
- Delivery: the seller brings the item, or sends it with a delivery app (Grab, Lalamove and similar), inside the post's delivery area. Arranged between the students; the app books nothing and handles no fee. Meet-up location and delivery area are free text, and the form suggests public campus spots. (Decided 2026-10-16.)
- Idle deal limits (7 days to schedule, 7 days after the meeting to complete) and the confirmation reminder times are Assumed. The owner may change them.
- Moderation: the threshold of 3 reports, how fast the owner can review the queue, and coordinated false reports. A student whose reports the admin keeps dismissing might later count less. Not designed.
- Block visibility: is blocking fully mutual-invisible, as assumed?
- Verified mark: a second level (for example confirmed studiskarte) that makes the mark meaningful?
- What remains after an account is deleted? Assumed: profile and email erased, sent messages stay as "deleted student".
- **Student data privacy and safety**: some students may be minors, and meeting strangers is a real risk. The Philippines has a data privacy law. The owner must check consent, retention, and the text of the three legal pages before launch. I cannot write the legal text or give legal advice.
- Safety guidance for meet-ups (for example suggest public campus locations). Open: should the system require a campus location from a list?
