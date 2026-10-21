DRAFT for lawyer review, not live.

# Philippine law research memo for Studiskarte Marketplace (2026-10-22)

For the owner and a Philippine lawyer. This is engineering research, not legal advice. Nothing here says the app complies with any law. It lists what the primary texts say, what that may mean for a student marketplace that hosts user content and may have members under 18, and what the lawyer needs to decide.

## How to read this memo

- **"Read"** means I read the text on the page named under "Read at". A section number is quoted only if it appears in that text. Paraphrases are short and may be wrong in detail: check against the official text.
- **[to confirm]** marks anything I did not read, or could not verify, or that is my reading rather than the text.
- Most Philippine government sites refused connections from here (see "Not read" at the end). Where a copy came from a secondary host, I say so.
- The owner has decided on a minimum age for members that is **not 18**. The older drafts in this folder (`terms.md`, `age-confirmation.md`) say "18 and over". They need to change with this decision. See "Where each law lands".

## Findings that change earlier assumptions

- **RA 9775 is repealed in full, not "in part".** RA 11930 Sec 44 repeals RA 9775 and "Section 4 (c) (1)" of RA 10175. In the RA 10175 text I read, Sec 4(c)(1) is **Cybersex** and Sec 4(c)(2) is **Child Pornography**. The repeal clause may have named the wrong paragraph. Question for the lawyer (see item 7).
- **RA 10586 is not about alcohol sales.** The text I read is the Anti-Drunk and Drugged Driving Act. For alcohol sold to minors, the only national text I found is PD 1619 Sec 6 (liquor of 30 percent alcohol or more). See item 9.
- **The 24-hour and 3-day clocks in RA 11930 are two different duties** (Sec 9(a)(3) and 9(a)(4); Sec 7(3) and IRR Sec 129(c) add a third 24-hour report to keep immunity). See item 1.
- **The Internet Transactions Act has a published IRR** (JAO 24-03, signed 2024-05-24). I read it only as an OCR of a scanned PDF. It excludes C2C sales "regardless of the platform used", but it lists presumptions that make a regular seller a business. See item 3.
- **The NPC says there is no "age of digital consent" in the Philippines and only Congress can set one** (FAQ to Advisory 2024-03, Q6). Capacity to consent stays with the Civil Code. See items 5 and 6.
- **No cookie-specific law or NPC cookie guidance was found.** See item 8.

## 1. RA 11930, Anti-OSAEC and Anti-CSAEM Act (2022), and its IRR

### What it is

A 2022 law against online sexual abuse or exploitation of children (OSAEC) and child sexual abuse or exploitation material (CSAEM). It repeals the Anti-Child Pornography Act (RA 9775). It puts duties on "internet intermediaries" with short deadlines. It lapsed into law on 30 July 2022. Its IRR was signed on 18 May 2023 by the DSWD and DOJ Secretaries (UP Law Center page, read).

Read at:
- [RA 11930 on lawphil.net](https://lawphil.net/statutes/repacts/ra2022/ra_11930_2022.html), in full.
- [The IRR on the Supreme Court E-Library](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/97582), in full text (a secondary host; its definition of "child" has a typo "(10)" for 18, so compare with the signed copy [to confirm]). The Senate library says the IRR was published in the Philippine Star on 2 June 2023, pages 16 to 20 (search snippet only, not read) [to confirm].
- [UP Law Center page](https://lawcenter.law.upd.edu.ph/IGLR/Pages/anti-osaec-irr) for the signing date.

### Sections read

Definitions (Sec 3):
- **Child** (3(a)): under 18, or older but unable to protect themselves because of a disability or condition. It also covers anyone, **of any age, who is presented or portrayed as a child**, and computer-generated or crafted images of a person made to appear a child.
- **CSAEM** (3(c)): any representation, **visual, video, audio or written**, of a child in real or simulated sexual activity, or of acts of sexual abuse or exploitation of a child as a sexual object. It includes material focused on a child's genitals or other private parts.
- **OSAEC** (3(t)): using ICT to abuse or exploit children sexually. It includes producing, spreading or possessing CSAEM, online grooming, sexual extortion, sharing image-based sexual abuse, and livestreaming.
- Also defined: grooming (3(i)), luring (3(s)), image-based sexual abuse including "sextortion" and AI "deepfake" porn (3(j)), pandering (3(u)), sexualization of a child (3(z)).
- **Internet intermediaries** (3(p)): persons that provide infrastructure, platforms or access, and **host, transmit and index content, products and services made by third parties**. The list includes ISPs, web hosting providers, search engines, **e-commerce intermediaries**, payment providers and **participative network platform providers including social media**. See also 3(v) (platforms where users contribute, rate, share pictures or files) and 3(dd) (web hosting provider: supplies server space that lets a user post, upload and share content). The IRR repeats the list in Sec 4(s).
- **ISP** (3(q)): an NTC-authorised telecom or VAS provider that gives internet connection. A student marketplace is not an ISP [to confirm].

Prohibited acts (Sec 4, whatever the child's consent, online or offline): hiring or coercing a child into CSAEM; producing it; **offering, selling, distributing, advertising or promoting it** ((c)); **knowingly publishing or transmitting it** ((d)); streaming abuse; benefiting from it ((k)); providing a venue ((l)); **luring or grooming a child** ((m)); **sexualizing children as objects of sexual fantasy in any online platform** ((n)); **pandering**, which is offering or advertising material that "purports to contain" CSAEM, whatever its real content ((o)); joining or supporting a site that hosts OSAEC ((p)); **possessing CSAEM** ((r); three or more is prima facie intent to sell or distribute); **willfully accessing it** ((s)); conspiring ((t)).

Other sections:
- Sec 5: the child's consent is no defence. Sec 6: a syndicate is 3 or more offenders; large-scale is 3 or more victims.
- **Sec 7 (Good Samaritan):** no civil, criminal or administrative liability for reporting, blocking, removing or taking down, if the act was in good faith, necessary to prevent access or spread of CSAEM, **and reported within 24 hours of the act of blocking or taking down**. The Act does not say to whom. The IRR (Sec 129(c)) says the DOJ Office of Cybercrime (DOJ-OOC).
- **Sec 8 (Safe harbor):** no liability for accessing, possessing or recording CSAEM to comply with the Act, to report to authorities, or for legitimate investigation. IRR Sec 130 repeats it.
- **Sec 9(a), duties of internet intermediaries:**
  - (1) Put in the terms of service a **ban on streaming or livestreaming of OSAEC and CSAEM**. IRR Sec 110(a): an intermediary whose terms already contain "substantially similar" bans is deemed compliant.
  - (2) **Preserve** subscriber or registration information and traffic data for 6 months from the transaction, extendible by 6 months or while a case is pending; **content data for 1 year**, extendible by 6 months on notice. The authority must say what to keep. Integrity must be protected. The longer of this period and the foreign-corporation law period prevails. The IRR (Sec 110(b)) says the extension runs "upon notice by the competent authority" and lists what a preservation notice must contain (11 items, including the URL, IP, dates and time zone). IRR Sec 28 says content data is kept for 1 year from receipt of the order.
  - (3) **Block, remove or take down, immediately and within 24 hours**, any URL or content with CSAEM or livestreamed OSAEC, **from receipt of a notice from a competent authority, or a notice with enough information to identify the content and its source**. The period may be extended by another 24 hours on written justification if the notice came from a **private citizen**, or from an authority without enough information. IRR Sec 110(c) adds: one more 24-hour extension, once, on the intermediary's written request if the notice is incomplete or review is long. It also sets the **content of a notice**: from a private citizen, the specific URL or content, the date and time (with time zone) it was last accessed, and other facts. Intermediaries "may adopt automated systems and dedicated channels" to receive notices.
  - (4) **Report to the DOJ within 3 days** the addresses blocked, removed or taken down, "or any form of unusual data activity". A foreign intermediary that must report to its own government's cybercrime body is deemed compliant if it tells the DOJ. IRR Sec 110(d): report to **DOJ-OOC and the NCC-OSAEC-CSAEM Secretariat**, in writing, with 8 listed items, and copy the DICT and the NTC.
  - (5) **Give subscriber or traffic data on a subpoena** from the PNP, NBI or a prosecutor, about a person who accessed or tried to access a site with CSAEM, facilitated a violation or livestreamed. The subpoena must be specific. IRR Sec 110(e) lists what it must state.
  - (6) Put in place measures to **prevent, detect, respond and report** (IRR Sec 110(f): "continuously", and consult the NTC, DICT and DOJ-OOC).
  - (7) Coordinate with the DOJ-OOC on the standard for "reasonable compliance" (IRR Sec 110(g)).
  - (8) **Have a policy on notifying the community** that allows **delaying or skipping notice to an account holder who is a suspected OSAEC offender** in an ongoing criminal investigation about a subpoena, warrant, order or other government request for their data. IRR Sec 110(h) refers to a "child online safeguarding policy" by the DICT under RA 10929 [not read].
  - IRR Sec 110, closing paragraphs: nothing requires an intermediary to **monitor** any user or content; these duties do not replace other laws; they are part of the requirements when applying for registration, permits or licences.
- **Sec 9(b), ISPs only:** notify the PNP or NBI within 48 hours; block within 24 hours; keep IP logs. Not for us [to confirm].
- **Sec 9(c), payment providers:** report to the DOJ-OOC within 24 hours and to the AMLC within 5 days, "any person who has direct knowledge of any OSAEC and CSAEM financial activity". The app handles no money, so this should not apply, but the sentence starts with "any person" [lawyer to confirm].
- **Sec 10, penalties:** most Sec 4 acts carry life imprisonment or reclusion temporal to perpetua and fines from P200,000 up to P2,000,000 and more (possession (r): reclusion temporal and at least P300,000; willful access (s): prision mayor maximum and P200,000 to P300,000). **A violation of Sec 9 (the intermediary duties): prision mayor in its medium period and a fine of P1,200,000 to P2,000,000 for a first offence; P2,000,000 to P3,000,000 and revocation of licence or franchise and closure "when applicable" for a later offence.** Sec 11: if the offender is a juridical person, the owner, manager or responsible officer who took part or "knowingly permitted or failed to prevent" the crime is liable, and the company is fined 10 to 30 percent of net worth. The app is run by an individual, so Sec 3(x) (a "person" is any natural or juridical entity) and Sec 10 apply to the owner directly [to confirm].
- **Sec 21:** the child's identity and records are confidential; it is unlawful for editors, content creators and "social media influencers" to cause undue publicity.
- **Sec 23:** law enforcement must act at once on statements from victims, families and others including the **private sector**; agencies must build online and in-person reporting that is child-friendly. Victims who record or send material to report are not liable under the Anti-Wiretapping Act or the Cybercrime Prevention Act.
- Sec 24: anyone with personal knowledge may file a complaint. Sec 30 to 32: the NCC-OSAEC-CSAEM sits under the Inter-Agency Council Against Trafficking (IACAT); referral pathway. Sec 35: age verification is for **adult content providers**, not for us. Sec 39: the old IACACP moves to the NCC. Sec 44: repeals RA 9775 and RA 10175 Sec 4(c)(1).

IRR, reporting and children (read):
- **IRR Sec 5:** any person with direct knowledge of a Sec 4 act shall immediately report it, orally, in writing or otherwise, to the Barangay Council for the Protection of Children or barangay authorities, the LSWDO, the nearest police or other law enforcers, the Local Council for the Protection of Children, the **School Child Protection Committee**, regional or local anti-trafficking committees, any member agency of the NCC-OSAEC-CSAEM, or any member of the IACAT.
- **IRR Sec 6:** whoever receives a report acts on it within 24 hours; urgent cases are referred at once.
- **IRR Sec 102(b):** named reporting structure: PNP Women and Children Protection Center (Camp Crame) and the PNP Anti-Cybercrime Group; NBI Cybercrime Division, Anti-Human Trafficking Division and Anti-Violence Against Women and Children Division; the DSWD and the DOJ.
- **IRR Sec 126(b):** where a child produces sexualised material themselves ("self-generated CSAEM"), **the child is treated as a victim, not an offender**, and law enforcers look into who groomed the child and who received the material. Sec 126(a): a child offender is dealt with under the Juvenile Justice and Welfare Act (RA 9344) [not read].

### What it means for us

- The app stores photos, text and message pictures from third parties. It very likely counts as an "internet intermediary" (a platform that hosts content made by users) [to confirm]. The Sec 9(a) duties then apply to the owner personally. The ISP and payment duties probably do not.
- **Terms:** add a plain ban on livestreaming or streaming of OSAEC and CSAEM, and on CSAEM and sexualised content about children, including AI-made or written material (Sec 3(a), (c)). A ban that is "substantially similar" is deemed compliant (IRR Sec 110(a)).
- **Notice route:** anyone, even a private citizen, can send a notice. It counts if it has "sufficient information to identify the content and its source". The report form and the support mailbox should ask for the URL or listing link, the date and time (with time zone) it was seen, and any other facts. That is the IRR's list for a private notice.
- **24-hour takedown on a clear notice, with a solo owner.** This needs an alert on new reports of this kind and a "remove first, review after" step for suspected CSAEM. The app has no alert today (see README, build items).
- **Preservation and deletion promises clash.** Account deletion and the retention list in the Privacy Policy must carve out data under a preservation notice or legal hold. The Data Privacy Act itself allows retention "as provided by law" (DPA Sec 11(e), read). Whether the Act requires keeping logs **by default** for 6 months, or only on notice, is not clear from Sec 9(a)(2) alone [lawyer to confirm].
- **Reports to the DOJ-OOC and NCC** within 3 days, with a written report of 8 listed items (IRR Sec 110(d)). The owner needs a template and a log. The report channel details are not read (see "How to report CSAM").
- **Do not tell the account holder** when a government request about them arrives in an OSAEC case. The Terms or Privacy Policy need a clause that allows delay or skipping of notice (Sec 9(a)(8)). RA 10175 Sec 13 also makes a preservation order confidential (read).
- **Moderation by the owner:** viewing, saving or recording CSAEM to comply with the Act or to report is protected (Sec 8, IRR Sec 130). Keep it minimal: do not copy, forward or screenshot beyond what a report needs [lawyer to confirm].
- **Minors on the app:** a member under 18 who sends a sexual picture of themselves is a victim under the IRR (Sec 126(b)). The takedown and suspension steps must not punish or shame the child, and must not publish who they are (Sec 21). Grooming and luring (Sec 4(m)) are offences even where the child agrees (Sec 5): the app's chat is a place where an adult member could approach a minor member. This is a design question for the owner: for example, who can message a member under 18.
- The Act's **age verification** rule (Sec 35) is for adult content providers. It is not an app duty on its face.

### Open questions

1. Is the app an "internet intermediary" and which kind? Is there any threshold for a very small platform? Does a solo owner carry Sec 10 personal liability?
2. Sec 9(a)(2): is baseline preservation mandatory, or only on a competent authority's notice? What logs does the app actually hold (database, Vercel, Sentry, Resend, Cloudflare)? [to confirm]
3. Which clock rules when? Takedown 24 hours (Sec 9(a)(3)); report to DOJ-OOC and NCC in 3 days (Sec 9(a)(4); IRR Sec 110(d)); and the 24-hour report in Sec 7(3) and IRR Sec 129(c) to keep immunity. Can one written report meet all three?
4. The 24-hour extension for private-citizen notices: "upon submission of a written justification". To whom, and in what form? The IRR adds one more extension on request.
5. Is Sec 9(c) (any person with direct knowledge of OSAEC financial activity must report to the DOJ-OOC within 24 hours and AMLC within 5 days) aimed only at payment providers?
6. Wording for the "no notice to the suspect" clause, and what the "child online safeguarding policy" under RA 10929 requires (IRR Sec 110(h)) [not read].
7. RA 11930 Sec 44 repeals RA 10175 "Sec 4(c)(1)". In the RA 10175 text that is Cybersex. Child pornography is Sec 4(c)(2). Which is meant, and what is left of Cybersex and of Sec 4(c)(2)? (RA 10175 Sec 4(c)(2) points to RA 9775, which RA 11930 repealed.)
8. Penalties and duties for minors who are members, and for platforms that detect a minor's self-generated image (IRR Sec 126(b) with RA 9344).
9. The notice and report formats (IRR Sec 110) and the preservation notice: are there official forms? [to confirm]

## 2. RA 8792, E-Commerce Act (2000)

### What it is

The law that gives legal effect to electronic documents, electronic signatures and electronic contracts, and sets a limit on the liability of "service providers". Read at: [lawphil.net](https://lawphil.net/statutes/repacts/ra2000/ra_8792_2000.html), in full.

### Sections read

- Sec 4: applies to data messages and electronic documents in **commercial and non-commercial** activity.
- Sec 5(h), (j): "intermediary" and "service provider". A service provider is one that provides online services or network access, **or the technical means by which an electronic document is stored and made accessible to third parties**. It has no authority to change the content.
- Sec 6, 7, 16(1): electronic data messages and documents have legal effect; an offer, acceptance and other elements of a contract may be expressed in electronic messages, and no contract is denied validity only because it is electronic.
- **Sec 30 (liability of a service provider):** a service provider that "merely provides access" is not civilly or criminally liable for (a) the parties' obligations under the document, or (b) the making, publication or spread of the material, including infringement, **if** (i) it has no actual knowledge, and is not aware of facts or circumstances from which it is apparent, that the material is unlawful or infringing; (ii) it does not knowingly receive a financial benefit directly attributable to the unlawful activity; and (iii) it does not itself commit, induce or cause the unlawful act. Nothing in the section affects (a) obligations founded on contract; (b) obligations under a licensing or regulatory regime; (c) obligations under any written law; (d) a **court order** to remove, block or deny access or to **preserve evidence**.
- Sec 29: the DTI supervises e-commerce. Sec 33(c): Consumer Act violations through electronic documents carry the Consumer Act penalties. Sec 33(b): online piracy of protected works is penalised. Sec 38: parties may vary the Act's provisions by agreement among themselves.

### What it means for us

- The Terms can be accepted by a click. A click-through account creation is an electronic contract (Sec 16(1)) [lawyer to confirm for minors, see item 5].
- Sec 30 protects a host **only until it knows or is told**. A clear report moves the app from "unaware" to "aware". Prompt removal after notice, and a record of it, fit the text. The protection is also lost if the app knowingly benefits financially from the unlawful activity: partner perks and fees need a look [lawyer to confirm].
- Sec 30 does not displace RA 11930, the Internet Transactions Act or the Data Privacy Act. The proviso keeps "any obligation imposed under any written law".
- The Terms should not claim that Sec 30 makes the app immune. The liability clause in `terms.md` is already worded to avoid claiming that.

### Open questions

1. Does an app that hosts, shows, ranks and moderates content "merely provide access" under Sec 30? Sec 5(j)(ii) covers storage, but the lead-in says "merely provides access".
2. What is "actual knowledge" or "aware of facts or circumstances" when a report is unverified?
3. Does the Sec 30 protection reach a solo owner who is not a company?

## 3. RA 11967, Internet Transactions Act (2023), and its IRR (JAO 24-03)

### What it is

A law on internet transactions between businesses and consumers. It creates the DTI E-Commerce Bureau, DTI takedown powers, and duties for e-marketplaces and for "other digital platforms that do not retain oversight". I summarise only; it was read in full earlier and re-read now. Read at: [RA 11967 on lawphil.net](https://lawphil.net/statutes/repacts/ra2023/ra_11967_2023.html).

### Sections read (Act)

- **Sec 3:** applies to business-to-business and business-to-consumer internet transactions within the DTI's mandate. "Online media content, and consumer-to-consumer (C2C) transactions shall not be covered." **Sec 4(c):** C2C means transactions between end-users for personal, family or household purposes and **not done in the ordinary course of business**.
- Sec 4(d), (e), (j): "digital platform"; "e-marketplace" (connects consumers and online merchants, may facilitate shipment or logistics or post-purchase support, **and retains oversight over the consummation of the transaction**); "online merchant" (sells through an e-marketplace or third-party platform).
- **Sec 15:** the DTI Secretary may issue an **ex parte takedown order** for a listing, **regardless of the intended nature of the transaction**, for prohibited or regulated goods (endangered animals, illicit drugs, fireworks and explosives, counterfeit goods) if apparent from the photo or description; goods under a cease-and-desist order; reposts after a takedown; and other offers that threaten public or personal safety or compromise personal information. A hearing within 48 hours; the order lasts up to 30 days; it is directed at the merchant **and the owner or operator of the platform**.
- **Sec 22 (platforms that do not retain oversight):** (a) let consumers tell commercial from private accounts; (b) prohibit sale and advertising of regulated goods unless permit and licence information is given, and make sellers contractually bound to the sale rules; (c) require sellers to show name and brand, price, description, condition and contact information; (d) an effective and responsive redress mechanism to report a user or information; (e) as far as practicable, keep a list of accounts used for e-commerce and give information on a subpoena; (f) protect data privacy under the Data Privacy Act. Ordinary diligence; penalties under Sec 29.
- **Sec 24:** an aggrieved party must use the platform's internal redress mechanism first; it is deemed exhausted if unresolved after **7 calendar days**.
- Sec 25: the merchant is primarily liable. **Sec 26:** the platform is subsidiarily liable if it fails to use ordinary diligence under Secs 21 and 22 and the consumer suffers loss; if, **after notice, it fails to act expeditiously** to remove goods that infringe IP or are subject to a government takedown order; or if a merchant with no legal presence has no contact details given. No liability for good-faith reliance on a merchant's papers if it shows reasonable effort. **Sec 27:** solidary liability if, after notice, it fails to act expeditiously to remove goods that are prohibited by law, imminently injurious, unsafe or dangerous.
- Sec 29: DTI administrative fines. For breaches of Secs 21, 22(b), (c) or (d) the scale runs up to P100,000 for a third offence; the printed amounts are inconsistent on lawphil, so check the official text [to confirm]. Sec 31: IRR within 90 days. Sec 32: an 18-month transitory period. Sec 33: the Civil Code on sales applies.

### Status of the IRR (JAO 24-03)

- The IRR is **Joint Administrative Order No. 24-03, series of 2024**, signed by the DTI, DICT, NPC, DA, DOH and BSP on **24 May 2024** ([eLegal Philippines article](https://elegal.ph/internet-transactions-acts-irr-released/), read; secondary source). The Act became effective on 20 December 2023 per the same article.
- I read the IRR as an **OCR of the scanned PDF** at the DTI file host linked from that article (21 pages, DTI S3 file "SIGNED_IRR OF THE ITA"). The OCR drops some lines. Section letters in the definitions are unreliable. Check against the DTI copy.
- IRR points read (OCR): Sec 2 defines C2C as transactions between end-users for personal, family or household purposes and not in the ordinary course of business, "**regardless of the platform used**". It then lists what is **presumed B2C**: selling through an organised or permitted setup (for example a barangay or LGU permit, a BIR-registered receipt, a logo; the text is partly lost); selling "as a continuous business activity to generate income"; and transactions not for personal, family or household purposes. "The value, frequency and volume of sale" may be considered. Sec 3 and 4: C2C sales, purely offline sales and online media content are excluded; **live-selling counts as advertising**. Sec 14: takedown order, same grounds as the Act. **Sec 33:** obligations of digital platforms without oversight, repeating Act Sec 22 with extras: compliance with the law at all times ("transactions with online merchants that are not in compliance ... are not allowed"), and sellers must also state **where the goods are produced**. Sec 38: internal redress, 7 calendar days. Secs 39 to 41: primary, subsidiary and solidary liability (as in the Act). Sec 48: the 18-month transitory period.
- The transitory period was 18 months from effectivity, so it ended about **20 June 2025**. A Philippine News Agency headline in search results says "DTI begins full enforcement of e-commerce law" (the page itself returned 404) [to confirm]. A DTI order setting how notices, subpoenas and takedown orders are served is still pending: IRR Sec 16 says those orders "shall be subject to the issuance of additional rules" by the DTI [to confirm whether issued].
- The IRR does not, in the OCR I read, say how a notice must look or how many hours "expeditiously" means [to confirm: pages may have been lost in OCR].

### What it means for us

- **C2C exclusion may cover a student's one-off sale.** It may not cover a student who sells regularly "to generate income", and the IRR presumes that case is B2C. The app cannot tell in advance. The drafts are written to work either way.
- If a seller is an "online merchant" and the app is a "platform without oversight", the Sec 22 duties apply to the app: tell commercial from private accounts, permit information for regulated goods, a minimum set of fields in a listing, a working report and redress channel, a list of e-commerce accounts, privacy. Several of these are the Takedown draft's content.
- **Does the app "retain oversight over the consummation"?** The app has offers, reservations and handover steps. It does not take payment or ship. The lawyer should decide whether that is "oversight" (Act Sec 4(e); Sec 21 duties are heavier, such as a government ID for merchants, Sec 21(b)).
- **Takedown powers:** the DTI may order a listing down and serve the order on the app. The app needs a way to act on one and a person to receive it.
- **Sec 24 (7 days):** an internal complaint is "deemed exhausted" after 7 calendar days. The Terms' complaint answer period should be 7 days or less if the Act applies [lawyer to confirm].

### Open questions

1. Does the Act apply to the app, or to a given seller (C2C exclusion; presumptions in IRR Sec 2)? Which side of the line is a student who sells 3 items a week?
2. Is the app an "e-marketplace" (oversight) or an "other digital platform" (Sec 22)?
3. What counts as "notice" and "expeditiously" in Secs 26(b) and 27? Any DTI rule on notices not yet read?
4. Is the 7-day period in Sec 24 a deadline on the app, or only the point at which the buyer may go to DTI or court?

## 4. RA 7394, Consumer Act (1992)

### What it is

The general consumer protection law: product standards, labelling, deceptive sales, warranties, liability for defective products. Read at: [lawphil.net](https://lawphil.net/statutes/repacts/ra1992/ra_7394_1992.html), in full text.

### Sections read

- **Art 4(n), (q), (s):** "consumer" is a natural person who buys or receives consumer products, services or credit; "consumer products and services" are those primarily for personal, family, household or agricultural purposes; "consumer transaction" includes a sale or other disposition of consumer products. **Art 4(bn):** a "seller" is "a person **engaged in the business** of selling consumer products directly to consumers". **Art 4(bu):** a "supplier" acts "in the course of his business".
- **Art 50:** deceptive sales acts or practices by a **seller or supplier**, including claiming a product is new, original or unused when it is "deteriorated, altered, reconditioned, reclaimed or second-hand" (50(c)), and false claims about warranty.
- **Art 67:** the **Civil Code** on conditions and warranties governs all contracts of sale with conditions and warranties. **Art 68:** extra rules on **sale of consumer products with warranty**: express warranty terms, "full" or "limited" warranty, breach (repair or refund for an express warranty; keep and claim damages, or reject, for an implied warranty); implied warranties last 60 days to 1 year for **new** consumer products (68(e)). Contrary stipulations are void (68(b)(6)).
- Art 40(a) and Art 31(a): selling adulterated or mislabelled food, drug, device or cosmetic, and selling a drug or device without effective registration, are prohibited ("any person").
- **Art 97, 98:** liability for defective products rests on the manufacturer, producer or importer, and on the seller only if the maker cannot be identified, the product has no clear identification or perishable goods were not kept properly. **Art 106:** a clause that prevents, excludes or reduces the obligation to indemnify for damages under these articles is prohibited.
- **Art 110:** false, deceptive or misleading advertisement is unlawful for "any person".

### What it means for us

- A one-off private sale between students is probably **not** a sale by a "seller" (Art 4(bn)). A student who sells regularly may be one [to confirm]. The Consumer Act's special warranty rules (Art 68) then apply mainly to sellers; the Civil Code applies to everyone (Art 67).
- The Act does not make the **platform** a seller or a manufacturer. Arts 97 and 98 name makers and, in limited cases, sellers.
- Art 50(c) matters for listings that call a used item "new" or "unused". The Terms' honesty rule already covers this.
- Art 106 is a reason **not** to write a clause that tries to disclaim a seller's liability for defective products in the Terms. The existing liability clause is worded to avoid overriding statute.
- RA 8792 Sec 33(c) adds that Consumer Act breaches through electronic transactions carry the same penalties.

### Open questions

1. Where is the line between a private seller and a "seller engaged in the business"? Is the app's "occasional seller" wording enough (see ITA IRR presumptions)?
2. Does the "course of his business" test in Art 4(bu) catch a student who sells handmade food regularly?
3. Which Consumer Act duties (labelling, price tags (Art 81, mentioned in IRR Sec 34 of the ITA), warranties) could reach regular student sellers? [to confirm]

## 5. Civil Code: sales, hidden defects, minors; and RA 6809 (age of majority)

### What it is

The Civil Code (RA 386) governs sale, warranties and contracts. RA 6809 (1989) lowered the age of majority from 21 to 18. Read at: [Civil Code on lawphil.net](https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html) and [RA 6809](https://lawphil.net/statutes/repacts/ra1989/ra_6809_1989.html).

### Sections read

Sale and warranty:
- **Art 1546:** an affirmation of fact or a promise by the seller about the thing is an **express warranty** if it tends to induce the purchase and the buyer relies on it. A statement of value or opinion is not, unless made as an expert.
- **Art 1547:** unless otherwise intended, an implied warranty that the seller has a right to sell, and that the thing is free from hidden faults or undeclared charges. Art 1548: eviction.
- **Art 1561:** the seller answers for **hidden defects** that make the thing unfit for its use, or reduce its fitness so much that the buyer would not have bought it or would have paid less. Not for patent (visible) defects, nor for hidden defects if the buyer is an expert who should have known them.
- **Art 1562:** implied warranty of fitness for a purpose the buyer made known and relied on; and, if the goods are bought by description **from a seller who deals in goods of that description**, an implied warranty of merchantable quality. Art 1563 to 1565: trade names, usage of trade, sales by sample.
- **Art 1566:** the seller is responsible for hidden faults "even though he was not aware". That does **not** apply "if the contrary has been stipulated, and the vendor was not aware" of them. **Art 1567:** the buyer may withdraw from the contract or ask for a proportionate price reduction, with damages in either case. **Art 1571:** these actions are barred **6 months after delivery**.
- **Art 1489:** necessaries sold and delivered to a minor must be paid for at a reasonable price (the text refers to Art 290, not read).

Capacity and consent:
- **Art 1327:** the following **cannot give consent** to a contract: (1) unemancipated minors; (2) insane or demented persons, and deaf-mutes who cannot write. Art 1329: this is subject to modifications by law.
- **Art 1390:** a contract is **voidable** if one party is incapable of giving consent, or if consent was vitiated. It is **binding unless annulled** by a court action, and can be ratified. **Art 1391:** the action lasts **4 years**; for contracts of minors, it runs "from the time the guardianship ceases". Art 1392 to 1396: ratification, expressly or by acts after the reason ceased, cleanses the contract. **Art 1397:** **capable persons cannot use the other party's incapacity** to get out of a contract. **Art 1398 and 1399:** on annulment each side returns what it received; **a minor must return only what benefited them**.
- **RA 6809 Sec 1:** majority begins at **18** and emancipation takes place on reaching it (amending Family Code Art 234). Sec 3: parents' and guardians' responsibility under Art 2180 (paragraphs 2 and 3) for children and wards **below 21** is kept.

### What it means for us

- **Listings are warranties.** A statement of fact in a listing ("battery lasts 5 hours", "no scratches") may be an express warranty (Art 1546). The Terms' honesty rule matches this.
- **Hidden defects:** an ordinary private seller who is not a dealer is not caught by the merchantable-quality rule in Art 1562(2), but **is** caught by Art 1547(2) and Art 1561 and 1566, subject to a stipulation to the contrary that works only if the seller did not know of the defect. "As is" language in the listing helps only for defects the seller did not know. A buyer has 6 months from delivery (Art 1571). The app should not promise a remedy it does not give. The Refund page can say this plainly [lawyer to confirm].
- **Minors:** if members under 18 can join, **the Terms are a contract with someone who cannot give consent** (Art 1327(1)). The contract is not void: it is **voidable**, binding unless the minor (or guardian) annuls it within 4 years after they turn 18 (Arts 1390, 1391). An adult counterparty cannot invoke the minor's age (Art 1397). Deals between members: a minor buyer or seller can annul; the other, if adult, cannot. Restitution by a minor is limited to what they benefited (Art 1399).
- **Parents:** RA 6809 Sec 3 and Art 2180 (text not read) keep parents' responsibility for children under 21 [to confirm what that covers].
- Cleanest design options for the lawyer: (a) require parent or guardian consent for members under 18, or (b) accept voidable contracts with minors and design the Terms and the data model around that. This is not for me to choose.

### Open questions

1. How should the Terms deal with a member under 18: parent or guardian consent, a parent clause, or only a notice that the contract may be annulled? What does the owner's minimum age change?
2. May an "as is" clause for used goods in the listing work to exclude hidden-defect liability (Art 1566, second paragraph)? Does it work when the buyer is a minor?
3. Is a regular student seller a "dealer" for Art 1562(2)? [to confirm]
4. What does Art 1489 ("necessaries") mean for sales to a minor on the app (Art 290 not read)?
5. Does a minor's contract with the app (Terms) need a different route than a minor's contract with another member?

## 6. RA 10173, Data Privacy Act (2012), IRR and NPC issuances on children

### What it is

The general data protection law. Read at: [RA 10173 on lawphil.net](https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html); the DPA [IRR (as amended) PDF on privacy.gov.ph](https://privacy.gov.ph/wp-content/uploads/2023/06/IRR_RA-10173-as-amended.pdf), in part (the extracted text was about 40,000 characters and may be incomplete); [NPC Advisory No. 2024-03](https://privacy.gov.ph/wp-content/uploads/2024/12/Advisory-2024.12.17-Guidelines-on-Child-Oriented-Transparency-w-SGD.pdf) and its [FAQ](https://privacy.gov.ph/wp-content/uploads/2024/12/FAQs-Advisory-on-Guidelines-on-Child-Oriented-Transparency.pdf), both in full; [NPC Circular 2023-04 on Consent](https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf), in full; the NPC [public advisory page](https://privacy.gov.ph/category/public-advisory/) (notices of 23 September 2026 and 11 August 2026).

### Sections read

DPA:
- **Sec 3(b):** consent is "freely given, specific, informed", shown in written, electronic or recorded form; it may be given by an authorised agent. IRR Sec 3(c) adds "a lawful representative".
- **Sec 3(l):** sensitive personal information includes **age**, **education**, health, sexual life and government-issued numbers. **Sec 13:** sensitive personal information may be processed only on listed grounds, mainly consent specific to the purpose, given before processing.
- **Sec 11** (principles: transparency, legitimate purpose, proportionality; retention only as long as necessary, "or as provided by law"); **Sec 12** (lawful grounds: consent, contract, legal obligation, vital interests, public order and function, legitimate interests); **Sec 16** (rights, including (e) to block or remove false or unlawfully obtained data); **Sec 20** (security, and (f) breach notice to the NPC and affected people); **Sec 21** (accountability for processors, and a designated accountable person).
- The DPA text has **no special rule for children or for the age of consent**. The IRR text I read has none either [to confirm for the parts not extracted].

NPC Advisory 2024-03, Guidelines on Child-Oriented Transparency (17 December 2024):
- **Sec 1:** covers anyone who processes children's data, including services "**likely to be accessed by children**". A child is under 18 (or older but unable to protect themselves).
- **Sec 2(A):** before launching a product or service intended **or likely** to be accessed by children, do a **Child Privacy Impact Assessment** as part of the PIA, and keep it up to date. Factors include purpose, data types, sources, data sharing, security, the age range of likely users, and the **involvement of parents or guardians**.
- **Sec 2(B)(1):** age assurance is optional but "relying solely on users' self-declaration may be inadequate for **high-risk** processing". **Sec 2(B)(2):** **high privacy settings by default** for children's accounts (no geolocation, private profiles, minimal sharing), and easy-to-find settings.
- **Sec 3:** child-readable privacy notices, just-in-time and layered; **child-friendly notice in addition to the standard one** where children are data subjects (3(B)); **no deceptive design** (3(E)).
- **Sec 4:** in a mandatory breach notification, notify **both the children and their parents or guardians**, in language the child understands. Sec 5: best interests of the child; accountability for processors.
- **FAQ Q3:** a child's lack of capacity to act does not reduce their data subject rights. **FAQ Q5:** the Advisory applies even if parental consent is obtained. **FAQ Q6:** there is **no "age of digital consent"** in the Advisory: setting one "will require legislative action", because capacity is governed by the Civil Code. **FAQ Q13:** the "parents or guardians" factor does not make parental consent mandatory. **FAQ Q14:** the NPC will not list approved age assurance tools. **FAQ Q15:** self-declaration is "not expressly prohibited" but may be inadequate for high-risk processing. **FAQ Q17:** a single notice for adults and children is not enough.

NPC Circular 2023-04 (Consent):
- Sec 1: the Circular does not change the Civil Code rules on obligations and contracts. Sec 12: consent may be obtained from a "lawful representative". Sec 7: consent is not freely given where refusal has adverse consequences; no deceptive design (7(A)). Sec 8: consent must be **granular**; consent for processing not necessary for the service must not be **bundled** (8(B)). Sec 10: consent is never implied; "continued use" counts only if the person was told what the service processes (10(C)). Sec 13: withdrawal as easy as giving consent. Sec 19: processing sensitive data through a contract counts as consent under DPA Sec 13(a) if the contract meets the consent rules. Sec 20: a waiver of data privacy rights is void. Sec 21: new consent when the processing changes much.
- Sec 3(D)(5)(a): a privacy notice is needed for any processing, not only consent-based.

NPC notices read:
- **Public advisory of 23 September 2026:** platforms accessible to minors must follow the DPA, with **privacy by design**, limits on automated processing, and "effective, privacy-preserving **age-assurance** mechanisms" to restrict minors from features meant for mature audiences, and no behavioural profiling that pushes unsafe content to children. It warns of compliance orders, cease-and-desist orders and penalties under Secs 25 to 33.
- **Notice of 11 August 2026 (AI-generated images of real people):** a face and likeness are personal information; making or sharing a synthetic image of a real person is processing that needs a lawful basis; a data subject may ask for removal (DPA Sec 16(e)); the NPC "will treat complaints involving the likenesses of minors with utmost priority"; **online platforms are expected to provide accessible reporting and prompt removal** on lawful demand.

### What it means for us

- If the app may be accessed by minors, **Advisory 2024-03 applies** to it on its face (Sec 1, "likely to be accessed by children"). That needs a Child Privacy Impact Assessment, child-friendly notices in addition to the standard Privacy Policy, high default privacy for under-18 accounts, and breach notices to children **and** parents.
- **Self-declared age** may be enough for a low-risk app and not enough for high-risk processing such as ID checks (FAQ Q15; Sec 2(B)(1)). Whether ID verification is the age check is for the lawyer.
- **Age and education are sensitive personal information** (Sec 3(l)). Collecting a birth date or age, a school and a role triggers Sec 13. Consent "specific to the purpose, before processing" is the usual ground. A minor's capacity to give that consent is a Civil Code question the NPC has left open (FAQ Q6).
- **Do not claim an "age of digital consent"** in the Privacy Policy. Safer: state the minimum age as a rule of the service, not as a legal age of consent.
- Core processing may rest on grounds other than consent (Sec 12(b) contract, 12(f) legitimate interests). A voidable contract with a minor weakens 12(b) [to confirm].
- Parental involvement is a design factor, not a rule (FAQ Q13).
- Platform-side content takedown on demand (NPC notice of 11 August 2026) agrees with the Takedown draft.

### Open questions

1. Does the Child Privacy Impact Assessment have to be done before the minimum age is lowered (Advisory Sec 2(A))? Is the PIA form in Circular 2023-06 required in practice? (Circular 2023-06 not read.)
2. Which processing is "high-risk" (age, ID pictures, messages between a minor and an adult) so that self-declared age is not enough?
3. Consent route for sensitive data (age, school) from members under 18: own consent, parent or guardian, or another ground?
4. What defaults apply to an under-18 account (profile visibility, who may message, whether non-student roles may contact)?
5. A child-friendly notice: format and tone (Advisory Sec 3(B), FAQ Q17).
6. Registration and DPO duties (read earlier, see README) are not repeated here.

## 7. RA 10175 Cybercrime, RA 9775 Anti-Child Pornography, RA 11313 Safe Spaces, RA 7610 Child Abuse, RA 9995 Voyeurism

### What it is

The criminal laws that sit around the app's content. Read at lawphil.net: [RA 10175](https://lawphil.net/statutes/repacts/ra2012/ra_10175_2012.html), [RA 9775](https://lawphil.net/statutes/repacts/ra2009/ra_9775_2009.html), [RA 11313](https://lawphil.net/statutes/repacts/ra2019/ra_11313_2019.html), [RA 7610](https://lawphil.net/statutes/repacts/ra1992/ra_7610_1992.html), [RA 9995](https://lawphil.net/statutes/repacts/ra2010/ra_9995_2010.html), and the Supreme Court's decision in [Disini v. Secretary of Justice, G.R. No. 203335](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/1/56650) (the dispositive part only).

### Sections read

RA 10175 (Cybercrime Prevention Act):
- **Sec 4(c)(1) Cybersex:** willful engagement, maintenance, control or operation, directly or indirectly, of lascivious exhibition of sexual organs or sexual activity with a computer system, for favour or consideration. **Sec 4(c)(2) Child pornography:** acts under RA 9775 committed through a computer system, one degree higher in penalty. **Sec 4(c)(3):** unsolicited commercial communications (opt-in or opt-out rules). **Sec 4(c)(4) Libel:** libel under RPC Art 355 committed through a computer system.
- Sec 5: aiding, abetting and attempt. Sec 6: crimes under other laws committed with ICT carry a penalty one degree higher. Sec 7: liability under other laws is not affected.
- **Sec 13:** service providers preserve traffic data and subscriber information for at least 6 months; content data for 6 months from a law-enforcement order; one 6-month extension; the provider **keeps the order and its compliance confidential**. Sec 19: DOJ may order blocking of computer data. Sec 20: non-compliance with law-enforcement orders is punished under PD 1829.
- **Disini (2014), dispositive part:** Sec 4(c)(1) cybersex, **Sec 4(c)(2) child pornography** (production), Sec 6 and Sec 13 are valid. **Sec 4(c)(3) (unsolicited commercial communications), Sec 12 (real-time traffic data) and Sec 19 (DOJ blocking) are void.** Sec 4(c)(4) libel is valid only for the **original author**, not for those who receive and react. Sec 5 (aiding and abetting) is void as to child pornography, unsolicited commercial communications and libel. Online libel and child pornography may not be charged under both RA 10175 and the RPC or RA 9775 (double jeopardy).

RA 9775 (Anti-Child Pornography Act of 2009), **repealed by RA 11930 Sec 44**:
- Sec 3 (definitions) and Sec 4 (prohibited acts). **Sec 9** ISPs: tell the PNP or NBI within **7 days**, preserve evidence, block. **Sec 11** internet content hosts: do not host child pornography; report within **7 days**; preserve evidence; **failure to remove within 48 hours of notice is conclusive evidence of willful violation**. Shown here to compare with RA 11930, whose deadlines are 24 hours and 3 days.

RA 11313 (Safe Spaces Act):
- **Sec 12 (gender-based online sexual harassment):** includes threats, unwanted sexual, misogynistic, transphobic, homophobic or sexist remarks online, including by private message; cyberstalking and "incessant messaging"; **sharing sexual photos, voice or video without consent**; unauthorised recording and sharing; impersonation and posting lies to harm reputation; and "**filing false abuse reports to online platforms to silence victims**".
- **Sec 13:** the PNP Anti-Cybercrime Group receives complaints and runs an online reporting mechanism; the CICC coordinates. **Sec 14:** prision correccional (medium period), or a fine of P100,000 to P500,000, or both; a juridical offender loses its licence. Secs 21 to 24: schools must have an officer to receive complaints and grievance procedures, and a school acts when it knows; **minor students are liable only to the school's administrative sanctions** (Sec 24).
- I found **no direct duty on platforms** in Secs 12 to 14.

RA 7610 (Special Protection of Children Against Abuse, Exploitation and Discrimination Act):
- Sec 3(a) child: under 18, or older but unable to protect themselves. Sec 3(b): child abuse, including psychological and physical abuse, neglect, cruelty, sexual abuse, and acts that "debase, degrade or demean" the child's dignity.
- **Sec 5:** child prostitution and other sexual abuse; it penalises those who **induce a person to be a client of a child "by means of written or oral advertisements"** (5(a)(2)) and those who commit sexual intercourse or lascivious conduct with a child exploited in this way (5(b)). **Sec 9:** using a child in obscene shows or publications, or **to sell or distribute** such material. **Sec 10(a):** other acts of child abuse, cruelty or exploitation; **10(e):** using a child to beg or as a **conduit in drug trafficking** or in other illegal activities. **Sec 14:** child models are not to be used in commercials or advertisements for alcohol, tobacco and violence. Sec 27: who may file a complaint. Sec 29: confidentiality.

RA 9995 (Anti-Photo and Video Voyeurism Act of 2009):
- **Sec 3(d), 4:** it is unlawful to take photos or video of a sexual act or of a person's private area without consent where the person has a reasonable expectation of privacy; and to **copy, sell, distribute, publish or broadcast** such material. Sec 4 says paragraphs (b) to (d) apply **even if the person consented to the recording**. The definition in Sec 3(d) speaks of sharing "without the **written** consent" of the people involved. How the two fit is a question for the lawyer. Sec 5: prison of 3 to 7 years and a fine of P100,000 to P500,000, or both. Sec 7: evidence obtained in violation is inadmissible.

### What it means for us

- Hosted listing photos or message pictures can contain intimate images shared without consent (RA 9995 Sec 4; RA 11313 Sec 12) or images of minors (RA 11930). The Terms already ban "sexual content". The Takedown draft should name **non-consensual intimate images** and **images of a child in a sexual context** as the fastest category.
- RA 7610 Sec 5(a)(2) and Sec 10(e) bear on **listings that advertise "services"** to or through a minor, and on any listing that uses a minor to deliver or sell illegal goods. RA 7610 Sec 14 bears on listings for alcohol or tobacco that show a child.
- **Libel (RA 10175 Sec 4(c)(4)):** members posting "name and shame" messages or reviews is a risk for members, not for the app as host. After Disini, only the original author is liable under that section. The RPC libel articles are not read [to confirm].
- **Sec 4(c)(3)** (unsolicited commercial messages) is **void** after Disini, so the app's email does not need to follow it. The Cybercrime Act is not a source for email-marketing consent in the Philippines [lawyer to confirm; the Data Privacy Act and Circular 2023-04 Sec 14 apply].
- **Report abuse:** RA 11313 Sec 12 treats **false abuse reports filed with platforms to silence a victim** as harassment. The Terms' sentence on false or repeated reports fits, and can cite the harm to victims.
- **Preservation duty:** RA 10175 Sec 13 and RA 11930 Sec 9(a)(2) both require preservation; the order is confidential (RA 10175 Sec 13).

### Open questions

1. What is left of RA 10175 Sec 4(c)(1) and 4(c)(2) after RA 11930 Sec 44? (See finding above and item 1, question 7.)
2. Does a student-to-student sale of "services" create exposure under RA 7610 Sec 5(a)(2) if the other party is a minor?
3. Is the RPC on libel relevant to the app's own moderation notices (for example a message to a member saying a listing was removed for "scam")? [RPC not read]
4. A Safe Spaces Act complaint route for harassment between members: should the Terms point members to the PNP Anti-Cybercrime Group (named in Sec 13) and to the member's own school? Is a school's duty (Sec 21) engaged by an app between its students?

## 8. Cookies and ePrivacy in the Philippines

### What I found

- **No cookie-specific statute and no NPC cookie guidance turned up.** I searched privacy.gov.ph and read NPC Advisory Opinions 2017-27, 2018-003, 2018-033, 2017-041, 2019-007, 2021-026, 2021-029 (none mentions cookies). Circular 2023-04 and Advisory 2024-03 do not mention cookies.
- There is no Philippine counterpart to the EU ePrivacy Directive in what I read [to confirm].
- **The Data Privacy Act applies if the data identifies a person:** "personal information" is data from which identity is apparent or can be reasonably and directly ascertained, or that "when put together with other information would directly and certainly identify" a person (DPA Sec 3(g); IRR Sec 3(l)). A session cookie tied to an account does. A purely anonymous counter may not (NPC Advisory Opinion 2017-27, read: truly anonymised data is outside the Act, but data is not anonymous if the raw data with identifiers still exists).
- **Consent route (if consent is used):** Circular 2023-04 Secs 7 to 10 and 13 say consent must be freely given, **granular**, **not bundled** with the service, **express** (never implied; "continued use" counts only if the person was told what is processed), and as easy to withdraw as to give; no deceptive design (Sec 7(A)). Non-essential cookies (analytics, ads) would need that.
- **Other routes:** strictly necessary processing for the service rests on contract or legitimate interest (DPA Sec 12(b), (f)), not on consent. Circular 2023-04 Sec 3(D)(5)(a) says a privacy notice is needed even then.

### What it means for us

- The Cookies page can say plainly what each cookie does. If the **only** cookie is the sign-in cookie (an unverified statement carried from the live text), no banner may be needed, and the page is a notice. If analytics or Sentry set cookies or use identifiers, a **real choice** (off by default, separate from accepting the Terms) would follow Circular 2023-04. [lawyer to confirm]
- Do not say "GDPR compliant" or "ePrivacy". Cite the Data Privacy Act and the NPC circulars. The marketusm.me banner says RA 8792 and RA 10173; RA 8792 has nothing on cookies in the text I read.
- For members under 18, avoid analytics that profile (NPC public advisory of 23 September 2026) [lawyer to confirm].

### Open questions

1. Does the NPC treat a session or sign-in cookie as personal information that needs a notice only?
2. Is a consent banner needed for analytics, error tracking (Sentry) and push services, and for which ages?

## 9. Regulated goods that may show up in student listings

### What I read

Food and health products:
- **RA 10611 Food Safety Act (2013),** [lawphil.net](https://lawphil.net/statutes/repacts/ra2013/ra_10611_2013.html): Sec 4(j), (k) define "food business" (any activity in a stage of the food supply chain) and "food business operator". **Sec 28:** licences, permits, certificates of registration or compliance for establishments, with special derogations for micro, small and medium operators. **Sec 37** (prohibited acts): producing, handling or manufacturing for sale, offering for sale or distributing food that does not meet standards ((a)); adulterating, misbranding, mislabelling or falsely advertising food ((e)); **operating a food business without the appropriate authorization** ((f)). Secs 13 and 14: duties of food business operators, including withdrawing unsafe food.
- **RA 9711 FDA Act (2009),** [lawphil.net](https://lawphil.net/statutes/repacts/ra2009/ra_9711_2009.html): Sec 10 (amending Sec 11 of RA 3720) prohibits the **sale, offering for sale, promotion or advertising** of any health product that is adulterated, **unregistered** or misbranded ((a), (j)); the manufacture, import, export, distribution or transfer of food, cosmetic or household hazardous substance, and the **retail of any drug, device or in-vitro diagnostic reagent**, **without an FDA licence to operate** ((k)); and selling past the expiry date ((l)). I did not read the full list of what counts as a "health product".
- **RA 7394 (Consumer Act)** Art 40(a), 31(a): see item 4.
- **Whether a student who sells home-made food or supplements needs an FDA licence, a sanitary permit or a barangay or LGU permit** depends on the IRRs and local rules, which I did not read [to confirm]. RA 10611 Sec 28 leaves room for derogations.

Vapes, tobacco, alcohol:
- **RA 11900 Vaporized Nicotine and Non-Nicotine Products Regulation Act (2022),** [lawphil.net](https://lawphil.net/statutes/repacts/ra2022/ra_11900_2022.html): **Sec 6:** minimum age to buy, sell and use is **18**; not knowing the buyer's age is **no defence**. **Sec 7:** retailers must check a government ID with photo and date of birth, and deliver only to people 18 or over. **Sec 8 (online trade):** allowed only if the seller keeps under-18s out, and **only by sellers registered with the DTI or SEC**; products must show the health warning and tax stamp. **Sec 19, last paragraph:** "Internet websites and/or e-commerce and/or other similar media selling platform providers shall **only allow** duly registered online sellers or retailers with the DTI and the BIR"; the DTI may order the takedown of a non-compliant page or account. **Sec 23:** anyone who sells to, buys for or buys from a minor is fined P10,000 or jailed up to 30 days for a first offence ((b)(i)); online sellers and platforms that do not comply with Sec 8 are ordered by the DTI to suspend trading and are fined ((c)); a minor caught selling, buying or using is referred to DOH and DSWD intervention programmes, counselling the minor and the parent or guardian ((b)(iii)).
- **RA 9211 Tobacco Regulation Act (2003),** [lawphil.net](https://lawphil.net/statutes/repacts/ra2003/ra_9211_2003.html): Sec 4(g): a "minor" is under 18. **Sec 9:** it is unlawful for a retailer to sell to a minor, **for anyone to buy tobacco from a minor**, and **for a minor to sell or buy**; not knowing the age is no defence. **Sec 21:** tobacco advertising on the internet is prohibited unless the site is restricted to persons 18 or over. Whether RA 11900 changed any of this: not read [to confirm].
- **Alcohol: PD 1619 (1979), Sec 6,** [lawphil.net](https://lawphil.net/statutes/presdecs/pd1979/pd_1619_1979.html): **the sale of and offer to sell to minors of liquor or beverages of 30 percent alcohol or more (60 proof) is prohibited**, with imprisonment of 6 months and 1 day to 4 years and a fine of P600 to P4,000. The decree does not define "minor" in the text I read, and I did not check whether later laws amended it [to confirm]. RA 7610 Sec 14: no child models in alcohol and tobacco ads. **RA 10586** (Anti-Drunk and Drugged Driving) is not a sales law. Local ordinances on alcohol: not read.
- ITA Sec 15 and IRR Sec 14 (item 3): DTI may take down listings for prohibited or regulated goods, and Secs 22(b) and 27 push the platform to prohibit regulated goods without permit information.

### What it means for us

- The Terms already ban medicine, drugs, alcohol, tobacco, vapes and weapons. This matches RA 11900 Sec 8 and Sec 19 (a platform may only allow DTI- and BIR-registered sellers of vapes: a student cannot qualify), RA 9211 Sec 9 and PD 1619 Sec 6, and keeps the app out of the DTI's Sec 15 and Sec 23 reach. **If minors can be members, the ban on tobacco and vapes is not optional in practice**: RA 9211 Sec 9 makes buying from, and sales by, minors unlawful.
- Food: the Terms say "if the law requires a permit or licence ... you must have it". That is accurate but vague. If the lawyer wants the listing to show a permit or licence for food, it follows ITA Sec 22(b) and IRR Sec 33(c) [lawyer to confirm which foods, and for which sellers].
- Medicine and "supplements": simplest is a flat ban (RA 9711 Sec 10(a), (j), (k); Consumer Act Art 31(a)).

### Open questions

1. Are home-made food and drinks sold by students "food business" under RA 10611 Sec 4(j), (k), and what authorisation does Sec 28 require for them? Does a one-time bake sale count?
2. Which of vapes, tobacco, alcohol, medicine and supplements should be a **flat ban** and which **allowed with conditions**?
3. Is PD 1619 Sec 6 still in force and what age is a "minor" there? What do local ordinances add?
4. Does the app need an age gate for categories the law limits to 18 and over? (RA 11900 Sec 8 mentions self-declared age on the first page.)

## Where each law lands in our documents

These are suggestions for the lawyer. They are not edits to the drafts. Each point names the source.

### Terms

- Minimum age sentence and **minors clause** (Civil Code Arts 1327(1), 1390 to 1399; RA 6809 Sec 1). The older `terms.md` says "18 or older" and must change with the owner's decision.
- A ban on streaming or livestreaming of OSAEC and CSAEM, and on CSAEM, grooming and sexualised content about children, including AI-made or written material (RA 11930 Secs 3(a), (c), 4, 9(a)(1); IRR Sec 110(a)).
- Clause allowing us to **delay or skip telling an account holder** about a government request in an OSAEC case (RA 11930 Sec 9(a)(8)).
- Clause that we **keep and give data to authorities** on a lawful order (RA 11930 Sec 9(a)(2), (5); RA 10175 Sec 13; ITA Sec 22(e)).
- Prohibited items: flat ban on vapes, tobacco, alcohol, medicine (RA 11900 Secs 6, 8, 19; RA 9211 Sec 9; PD 1619 Sec 6; RA 9711 Sec 10). Keep the food permit sentence.
- Non-consensual intimate images, harassment and false abuse reports as named bans (RA 9995 Sec 4; RA 11313 Sec 12).
- "No promise of immunity" in the liability clause (RA 8792 Sec 30; Consumer Act Art 106; DPA Circular 2023-04 Sec 20). Keep it as written.
- Seller honesty and listing statements may be warranties (Civil Code Art 1546); Consumer Act Art 50(c) on "new" claims.
- Complaint answer in **7 days or less** (ITA Sec 24; IRR Sec 38).

### Privacy Policy

- **Children's notice** in addition to the standard one; layered and just-in-time; no deceptive design (NPC Advisory 2024-03 Secs 2 to 3; FAQ Q17).
- Statement of **age and school as sensitive data** and the ground for it (DPA Sec 3(l), 13; Circular 2023-04 Secs 8, 19).
- **High privacy defaults** for under-18 accounts, and what they are (Advisory 2024-03 Sec 2(B)(2)).
- **Breach notice to the child and the parent or guardian** (Advisory Sec 4).
- Preservation and disclosure carve-outs from the retention list and from account deletion (RA 11930 Sec 9(a)(2); RA 10175 Sec 13). Do **not** promise "we delete everything on request" without a legal hold exception.
- No claim of a legal "age of digital consent" (FAQ Q6).
- Cross-references to Cookies page and Child Safety page.

### Refund page

- The app **does not handle money** and does not refund. Buyer and seller deal directly.
- Plain rule from the Civil Code: statements in a listing may be warranties (Art 1546); a seller answers for **hidden defects** the buyer could not see, unless it was stipulated otherwise and the seller did not know (Arts 1561, 1566); the buyer may withdraw or ask for a price cut (Art 1567) within **6 months from delivery** (Art 1571). Visible defects and the buyer's own expertise are excluded (Art 1561).
- Say that the Consumer Act and the ITA protect buyers only if the seller is "in business" / B2C, and that the app is not the seller (Consumer Act Art 4(bn); ITA Secs 3, 4(c), 25).
- A buyer who is a minor may be able to annul (Art 1390); do not promise otherwise.

### Cookies page

- List what the sign-in cookie and any others do (DPA Sec 3(g); Circular 2023-04 Sec 3(D)(5)(a)).
- If anything non-essential is added: an off-by-default choice, separate from the Terms, as easy to withdraw as to give (Circular 2023-04 Secs 7 to 10, 13).
- Do not cite the EU rules. Do not cite RA 8792 for cookies.

### Child Safety page (new)

- In short sentences: what is not allowed (CSAEM including AI-made and written; grooming; sexual messages to minors; intimate images shared without consent); what to do if it happens to you.
- Where to report **to us** (in-app Report and support email) and what to include (URL or listing link, date and time with time zone, what you saw: IRR Sec 110(c)(2)), and **not to forward or save the material**.
- What we do: remove at once on a clear notice, aim for **within 24 hours** (RA 11930 Sec 9(a)(3)); keep what the law tells us to keep; report to the authorities; we may not tell the account holder.
- A child who sent a sexual picture of themself is treated as a **victim** (IRR Sec 126(b)); we do not blame them.
- Where to report **to the authorities** (see below). Meeting-safety tips for minors. Parent or guardian contact route.
- Safe wording for the child-friendly version (Advisory 2024-03 Sec 3(B)).

### Takedown procedure

- A separate lane for **suspected CSAEM** (suspend first, report after; 24-hour target; IRR Sec 110(c)); the later report to **DOJ-OOC and NCC in 3 days** (IRR Sec 110(d)); a 24-hour report to keep Good Samaritan cover (RA 11930 Sec 7(3); IRR Sec 129(c)); a log with the 8 report items.
- A **legal hold** step: do not hard-delete content or logs once flagged or ordered (RA 11930 Sec 9(a)(2); RA 10175 Sec 13).
- Government takedown orders: DTI (ITA Sec 15; IRR Sec 14), NPC (notice of 11 August 2026), DOJ (RA 11930). Who receives them; how fast.
- Regulated goods lane (ITA Secs 22(b), 27; RA 11900 Sec 19). The existing "three reports hide a listing" rule should not slow a clear notice (ITA Secs 26(b), 27).
- Admin viewing rules: do not copy or forward CSAEM (RA 11930 Sec 8; IRR Sec 130 give cover only for compliance and reporting [lawyer to confirm]).

## How to report CSAM in the Philippines

What the Act and IRR themselves say (read):
- Anyone with direct knowledge of an OSAEC or CSAEM offence shall report it at once to: the barangay (BCPC), the LSWDO, the **nearest police or other law enforcement**, the Local Council for the Protection of Children, the **School Child Protection Committee**, the regional or local anti-trafficking committees, any member agency of the NCC-OSAEC-CSAEM, or any member of the IACAT (IRR Sec 5). The receiver must act within 24 hours (IRR Sec 6).
- Named agencies in the reporting structure: **PNP Women and Children Protection Center** (Camp Crame) and **PNP Anti-Cybercrime Group**; **NBI** Cybercrime Division, Anti-Human Trafficking Division, Anti-Violence Against Women and Children Division (IRR Sec 102(b)). RA 11313 Sec 13 names the PNP Anti-Cybercrime Group as the receiver of online sexual harassment complaints.
- **Platforms report blocked or removed addresses** to the **DOJ Office of Cybercrime and the NCC-OSAEC-CSAEM Secretariat** (IRR Sec 110(d)), with the 24-hour Good Samaritan report to the DOJ-OOC (IRR Sec 129(c)).
- **CyberTipline:** neither the Act nor the IRR names it. Sec 9(a)(4) only says that a **foreign** intermediary that must report to its own government's cybercrime body is deemed compliant if it tells the DOJ. A House bill whose search snippet mentions CyberTipline handling (HB 07901) is a bill, not law, and was not read [to confirm].

Contact points read on an official page:
- **MAKABATA Helpline 1383**, 24 hours a day, set up under Executive Order No. 79, series of 2024. The DSWD and the Council for the Welfare of Children tell the public to report OSAEC and CSAEM to law enforcement or to 1383 ([DSWD, 24 October 2025](https://www.dswd.gov.ph/dswd-cwc-urge-public-to-report-cases-of-child-abuse-to-makabata-helpline-1383/), read).

Update 2026-10-22: the owner copied the PNP WCPC, PNP WCCPU, NBI AHTD, DOJ-OOC, NCC Secretariat and 1343 contacts from the official NCC reporting page; they are now in `content/legal/child-safety.md`. The NBI cybercrime and PNP-ACG lines below remain unread.

Contact points **not read on an official page** (all [to confirm] before publishing):
- The NCC-OSAEC-CSAEM site has a page "Reporting Channel" (https://ncc-osaec-csaem.doj.gov.ph/NCCServices/ReportingChannel). It refused connections from here (HTTP 403, then a Cloudflare check). A search result snippet of that page listed numbers for the PNP Women and Children Protection Center ("Aleng Pulis": 0966-725-5961 and 0919-777-7377) and the PNP Women and Children Cybercrime Protection Unit; the snippet was cut off. Numbers and the full list must be copied from the live page by a person.
- **IACAT action line 1343**: seen only in a search result title of a 2015 DSWD post [to confirm it is current].
- **DOJ Office of Cybercrime**: address and phone seen only in a search snippet of its contact page (cybercrime.doj.gov.ph, which also refused connection) [to confirm].
- **NBI** and **PNP Anti-Cybercrime Group**: official reporting emails and hotlines not read. A third-party site listed some; it is not an official page and I do not repeat them.

For a Child Safety page, the draft should say "[to confirm: list copied from the NCC-OSAEC-CSAEM Reporting Channel page on the date of publication]" until a person checks it.

## Not read

Sources I could not open or did not open. Anything that leans on them is tagged [to confirm] above.

Could not open (HTTP 403, refused connection, certificate errors or Cloudflare checks):
- NCC-OSAEC-CSAEM site pages (reporting channel, home), the DOJ and DOJ Office of Cybercrime pages, the IACAT site, the Senate Legislative Reference Bureau pages for RA 11930, the PCW page on RA 11930, and the DTI e-commerce site (ecommerce.dti.gov.ph).
- The Philippine News Agency article on the end of the ITA transition (404); the UP Law Center NARO copy of JAO 24-03 (404).

Opened but partial or secondary:
- The ITA IRR (JAO 24-03): read only through OCR of a scanned PDF; text is incomplete in places.
- The IRR of RA 11930: the Supreme Court E-Library copy (secondary host), with a "(10)" typo in the child definition; the Philippine Star publication not read.
- The DPA IRR: partial text extraction.
- Disini v. Secretary of Justice: the dispositive part only.
- eLegal Philippines article on the ITA IRR (secondary).

Not read at all:
- **Statutes and rules:** Revised Penal Code (libel, Arts 353 to 355); Family Code and Civil Code Art 290 and Art 2180; RA 9344 (Juvenile Justice and Welfare Act); RA 9208 as amended (anti-trafficking, cited by RA 11930 Sec 4); RA 10929 and the DICT child online safeguarding policy (IRR Sec 110(h)); the Cybercrime Prevention Act IRR and the cybercrime warrant rules; the Anti-Wiretapping Act (RA 4200); RA 9165 (drugs); the IP Code (RA 8293); firearms and fireworks laws; the National Internal Revenue Code; local ordinances and the Local Government Code; RA 11930 joint DILG-AMLC rules under Sec 9(c).
- **Regulations on regulated goods:** the IRRs of RA 10611, RA 9711 and RA 11900; FDA circulars on online sale; whether RA 11900 amended RA 9211; any later law on alcohol sales to minors; local alcohol ordinances.
- **NPC issuances:** NPC Circular 2023-06 (Security of Personal Data, PIA), Advisory 2023-01 (Deceptive Design Patterns), and any other NPC issuance on cookies or on children not found by search. Circular 2022-04 and Circular 16-03 were read in an earlier round (see README) and not re-read.
- **Other:** the National Plan against OSAEC and CSAEM 2025 to 2028; pending House and Senate bills on child online safety; the NTC's blocking circulars; any DTI order on notice and takedown procedure under the ITA.
