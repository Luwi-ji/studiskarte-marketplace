# Evidence review: what makes peer-to-peer and second-hand marketplaces trustworthy, easy to use and retained

Prepared 2026-10-18 for the Studiskarte Marketplace UI/UX decisions. This file covers general research. Philippines-specific context (data costs, school calendar, local platforms) is covered by the separate Philippines research and is not repeated here.

## How to read this

**Ratings.** Every claim has a URL and a rating of the source:

| Rating | Meaning |
|---|---|
| **strong** | Peer-reviewed study or experiment, or first-party platform data / standards body. |
| **medium** | Credible practitioner analysis, a study from a very different context (noted), or a qualitative study whose findings are about what people say, not measured outcomes. |
| **weak** | Anecdote, vendor marketing, a single secondary report, or a claim I only saw in a search snippet. |

The rating says how good the source is. It does not say the result transfers to Philippine students. No study I found measures a verified-student-only marketplace, so every transfer is an inference unless stated otherwise.

**What I could not read.** ACM blocked full-text access (HTTP 403) to the CHI 2024 paper and to its 2025 follow-up. For CHI 2024 I used the abstract, the UBC press release, press coverage that quotes the paper, and the SOUPS 2026 paper's description of it. The SOUPS 2026 paper I read through section 6 (the conclusion); I did not read its reference list or appendix. Where I saw only a search snippet, the text says so.

## 1. The two anchor papers

### 1.1 CHI 2024, Facebook Marketplace (Mokhberi et al., UBC)

- **Method.** Interviews with 42 Facebook Marketplace users in the US and Canada. The authors group the factors that shape trading decisions into four categories: pre-existing concerns, signals, interactions, perceived benefits. Source: abstract, https://pgl.jp/papers/66415fcf825999002d96cb5b (paper: https://dl.acm.org/doi/10.1145/3613904.3641966). Rating: strong (peer-reviewed), qualitative, so no effect sizes.
- **Concerns are about the body first.** Physical safety, financial safety and well-being were top of mind because goods change hands in person. Women were particularly concerned about predatory or aggressive behaviour at meet-ups. Source: UBC release, https://news.ubc.ca/2024/05/facebook-marketplace-trust-issues/; fuller quotes in https://www.vancouverisawesome.com/highlights/do-you-use-facebook-marketplace-bc-study-suggests-trust-and-privacy-concerns-clash-8757897. Rating: medium (press quoting the paper).
- **Reassuring signals.** Prompt, polite replies, relevant questions about the item, and a profile that looks authentic. Source: https://www.vancouverisawesome.com/highlights/do-you-use-facebook-marketplace-bc-study-suggests-trust-and-privacy-concerns-clash-8757897 (press article quoting the paper; not in the UBC release). Rating: medium.
- **Warning signals.** Impolite, flirtatious or patronising language; many grammar errors (read as "foreign scammer"); irrelevant questions; for buyers, seller replies at unusual hours, item details that contradict the photos, delayed replies, no interest in negotiating the meeting place, pushiness. Same press article. Rating: medium.
- **Profile inspection is routine.** Participants looked at the other person's profile and profile picture to judge risk. Some removed their real name for privacy, which the article says may perpetuate trust issues on the other side. Same press article. Rating: medium.
- **Rating is socially costly.** Many participants hesitated to rate sellers because of physical-safety worries and the wish to stay anonymous. UBC release above.
- **Why people stay anyway.** Most participants kept using the platform because it is simple to set up, reaches a wide audience and sells things. UBC release above. This is the single most useful retention fact in the paper: perceived benefit outweighs persistent distrust when friction is low.
- **Privacy entanglement.** Participants disliked the inseparable link between Marketplace and their Facebook identity. The authors suggest profile verification and clearer privacy consequences. UBC release above.

### 1.2 SOUPS 2026, second-hand shopping in Germany (Zarkalam, Rotthaler, Simko, Acar)

Source for everything in this subsection: https://www.usenix.org/system/files/soups2026-zarkalam.pdf. Rating: strong as a peer-reviewed paper, but it is 20 semi-structured interviews (Sept to Nov 2024; mostly men, mostly computer-science students; Vinted, Kleinanzeigen, eBay users), so it reports perceptions, not measured outcomes. The authors state that generalisability was not the aim.

- **Reviews are the most-used safety feature.** Most participants check the other person's reviews before messaging. The number of ratings mattered more to them than the score ("a lot of good reviews", not "a few"). One participant said ratings below 98% on eBay meant no contact; another ignored Kleinanzeigen ratings because they did not trust that system. Design of the rating system matters, not just its existence.
- **Account age is used as a trust cue.** A few participants used the public sign-up date; "somebody has an account for years, and is pretty active" was reassuring.
- **Verification is wanted but limited.** A few wanted platform-verified identity. Others distrust platforms that ask for too much (phone, address, job). The authors recommend the platform act as data escrow: reveal only whether a user is verified and how (for example "government ID checked"), never the data itself.
- **Reviews only after a real transaction.** Vinted allows reviews only after a completed order, which raises the barrier to collusion. The authors recommend this. Predefined ratings ("on time", "honest", "reliable") were seen as a useful overview.
- **Off-platform pressure is a red flag.** Participants judged others by message tone, whether the conversation felt suspicious, and whether the other person insisted on moving to WhatsApp. About half used only in-platform chat because it felt safer.
- **Progressive disclosure.** Participants share personal details late, after some back-and-forth, and use secondary emails.
- **Meeting in person.** Most participants had concerns about meet-ups. Strategies: do not meet at home or in remote places; meet in public (parking lots, shopping centres, outdoors); prefer daylight and working hours (one said avoid "super late hours"); about half bring a companion. Two raised gender: women need extra care. The authors recommend borrowing from ride-hailing: send your location to a friend, report an immediate issue, and consider community-maintained safe exchange locations.
- **Platform trust is built from user trust.** About half said their trust in the platform depended on whether other users seemed real and honest. All participants said external opinions (Reddit, Trustpilot, friends) shaped trust in the platform itself.
- **Payments.** Integrated payment with buyer protection was the most-cited protection, but some users prefer cash for privacy and cost. Relevant here only as context: Studiskarte never moves money.

## 2. Trust signals and their measured effects

| Signal | What was measured | Result | Source | Rating |
|---|---|---|---|---|
| Established reputation | Randomised field experiment on eBay: one dealer sold matched pairs of postcard lots under his established identity and under new identities | Established identity earned 8.1% higher willingness to pay. One or two negative feedbacks on new sellers did not change willingness to pay. | http://presnick.people.si.umich.edu/papers/postcards | strong (2006, one product class) |
| Star ratings inflation | Ratings of millions of Airbnb listings vs TripAdvisor | About 95% of Airbnb listings average 4.5 or 5 stars (94% in 2015, 91% in 2018). Hotels average 3.8. Little spread means stars carry little information. | https://people.bu.edu/zg/publications/airbnbreviews.pdf | strong |
| Review count vs score | Prior work cited by the Cornell Tech Airbnb profile study | "Initial evidence" that the number of reviews predicts sales even when controlling for score. | https://s.tech.cornell.edu/assets/papers/ma2017airbnb.pdf (citing others) | medium (secondary citation); consistent with SOUPS interviews |
| Two-sided review timing | Airbnb field experiment (Fradkin, Grewal, Holtz 2021) | When reviews stay hidden until both sides have reviewed, retaliation and reciprocation fall and ratings drop, i.e. less inflated. I saw this only as summarised by another paper. | https://arxiv.org/pdf/2504.14053 (summary); original https://pubsonline.informs.org/doi/10.1287/mksc.2021.1311 (403, not read) | strong (original), weak access |
| Paying for reviews | Airbnb randomised coupon for first reviews on listings with none | More reviews, more negative (selection bias), temporary rise in bookings but for fewer nights, no detectable change in total nights or revenue, transaction quality fell. | https://arxiv.org/abs/2112.09783 | strong |
| Promote quality, not just feedback | eBay data plus controlled experiment | Buyers judge the platform from single transactions (reputational externality); feedback is biased; promoting sellers ranked by a better quality measure helped. | https://www.nber.org/papers/w20830 | strong |
| Profile text | 1,200 Airbnb host profiles rated for trustworthiness, then a pairwise choice experiment | Longer and more varied self-descriptions are rated more trustworthy, with diminishing returns: going from the first to second length decile (about 6 to 13 words) raised the score 18.9%; from the ninth to tenth (about 106 to 188 words) only 2.5%. Trustworthiness score predicted which host people chose, most for short profiles. 30.7% of hosts had an empty description. | https://s.tech.cornell.edu/assets/papers/ma2017airbnb.pdf | strong for perceived trust (online raters); not observed bookings |
| Hard-to-fake disclosures | Same study | Hosts most often disclosed origin or residence (68.8%) and work or education (60.3%), which the authors call assessment signals (hard to fake) as opposed to conventional signals (easy to claim). | same | strong |
| Response time | Observational study of Airbnb booking success | Superhost status, host response time and communication were among the most significant predictors of bookings. I saw only the abstract snippet. | https://www.sciencedirect.com/science/article/am/pii/S0148296321005968 | weak to medium (observational, snippet) |
| Photo quality | About 75,000 second-hand images (eBay and Letgo) | Better image quality is associated with higher likelihood of sale, but view count predicted sales better. User photos picked by the model beat stock photos for perceived trust. | https://arxiv.org/abs/1811.10648 | strong (peer-reviewed preprint) |
| Photo brightness and framing | Same group, press summary | Brighter, well-proportioned images were more often judged high quality. | https://www.cornellsun.com/article/2019/01/cornell-research-shows-poor-image-quality-can-affect-online-sales | weak (student newspaper summary) |
| Professional photos | Airbnb demand after verified photographer images | Demand changed after verified images were acquired, and 12 image attributes were modelled. I did not retrieve the effect size. | https://dl.acm.org/doi/10.1287/mnsc.2021.4175 | strong study, effect size not read |
| Size cue in photos | Baymard ecommerce usability testing | 42% of users try to judge product size from the product-page images; they recommend an "in scale" image. New goods, not second-hand. | https://baymard.com/blog/in-scale-product-images | medium (snippet only) |

Points that matter for design:

1. **Stars saturate; counts do not.** With 90%+ of ratings at 4.5 or above, a star average barely separates sellers. People reading profiles say the number of ratings is what reassures them (SOUPS).
2. **Reputation is worth something, but early negatives are survivable.** The eBay experiment found a premium for established identity and no measurable penalty from one or two negatives on a new seller.
3. **Review systems are gamed by design, not only by bad actors.** Reciprocity and fear of retaliation inflate ratings; paying for reviews does not fix it.
4. **Profile effort pays quickly and saturates quickly.** A sentence or two moves perceived trust a lot; a paragraph adds little.
5. **Photos build trust more than they move sales on their own.** Exposure (views) predicted sales better than image quality in the one large second-hand study found.

### Verification badges

- **Evidence gap.** I found no independent study that measures how an identity-verification badge changes conversion or trust outcomes in a peer-to-peer goods marketplace. Sift, Persona and Stripe Identity pages surfaced in search are vendor marketing; I saw only snippets and did not rely on them (weak).
- **What exists.** Qualitative demand for verification with privacy limits (SOUPS, above); the CHI authors' recommendation of a profile verification process; Karrot verifies location and mobile number for all users and shows a review-based rating (https://d3.harvard.edu/platform-digit/submission/a-closer-look-at-south-koreas-beloved-neighborhood-market-platform, medium: a student blog post); Karrot's sign-up needs only location and contact info (https://pmc.ncbi.nlm.nih.gov/articles/PMC10044753, strong as description).
- **Inference.** A school-verified mark is an assessment signal (hard to fake, shared affiliation) in the sense of the Cornell Tech profile paper, so it should carry more weight than a self-written claim. No source measures this for students.

## 3. Listing creation friction and what predicts a sale

- **Friction numbers are all first-party or vendor claims.**
  - Carousell says classifieds took about 30 minutes on average to post a listing, and that it cut this to about 30 seconds ("snap, list and sell"). https://press.carousell.com/wp-content/uploads/2022/11/thecarousellrecommerceindex-2022_en-final.pdf. Rating: weak (company self-description, no method).
  - A write-up of a Google Cloud case study says Mercari sellers spent 5 to 10 minutes on titles and descriptions and that photo-based AI listing support cut it to about 15 seconds, with the title/description step being the main psychological barrier for occasional sellers. https://note.com/repkuririn7/n/ncf6701a10d61?hl=en. Rating: weak (vendor case study retold by a third party; no conversion or listing-rate data).
  - A Harvard student blog says Karrot sellers can post in under 30 seconds. Rating: weak.
- **What I did not find.** No study that reports listing completion rate by number of required fields, by number of photos, or by time to first listing, and no study of an optimal photo count for second-hand items. The Cornell Tech study is the only quantitative second-hand evidence on photos and sales (above).
- **What predicts a sale (best available).** View count was a stronger predictor of sale than image quality (https://arxiv.org/abs/1811.10648, strong). That points to exposure and ranking, not just listing polish.
- **Warning signs buyers use.** Item details that contradict the photos (CHI 2024 as quoted in https://www.vancouverisawesome.com/highlights/do-you-use-facebook-marketplace-bc-study-suggests-trust-and-privacy-concerns-clash-8757897, medium), or stock photos instead of real ones (OfferUp's own guidance to check for "real photos of the items or just stock photos", https://help.offerup.com/hc/en-us/articles/360032330891-Safety-tips-for-meeting-up, strong as first-party guidance).

## 4. Cold start and liquidity

- **Atomic network.** Andrew Chen (a16z, previously Uber growth) argues a first network is "probably smaller and more specific than you think", on the order of hundreds of people at a specific moment, and that growing "city by city, campus by campus" gives dense connections that raise engagement and virality. Facebook's early campus launches are his example. https://www.lennysnewsletter.com/p/atomic-network. Rating: medium (practitioner book excerpt, no controlled data).
- **Why density matters.** Below the density needed for escape velocity, "buyers show up and don't see enough to buy" and sellers see no buyers, so the network tends to self-destruct. https://stripe.com/guides/atlas/andrew-chen-marketplaces. Rating: medium.
- **Supply side first for consumer-to-consumer.** Chen's rule of thumb: the side that does more work to join is the constraint. In C2C that is usually supply, so early effort goes to getting enough supply. Same URL. Rating: medium. In a student marketplace both sides are the same people, so "supply" means enough good, current listings on one campus.
- **Seasonality is real in marketplaces.** Chen notes Airbnb is supply-constrained in peak summer and oversupplied the rest of the year. Same URL. Rating: medium.
- **Hyperlocal worked in Korea.** Karrot limits listings to a radius of roughly 4 to 6 km, verifies location, keeps professional sellers out to preserve the local feel, and had 18 million monthly users in 2022. The same Harvard post doubts it transfers to less clustered, more private markets. https://d3.harvard.edu/platform-digit/submission/a-closer-look-at-south-koreas-beloved-neighborhood-market-platform. Rating: weak to medium (student analysis). A school is a tighter and more verifiable community than a 6 km radius.
- **Liquidity metrics.** Practitioner definitions: liquidity is the probability of selling what you list or finding what you look for; useful ratios are search-to-fill rate, time to fill and buyer-to-supplier ratio (https://writing.pointnine.com/p/wtf-is-marketplace-liquidity, seen as snippet only, weak).
- **Not found.** No evidence on how many active listings per campus are needed before a feed feels alive, and no evidence on whether wanted-ads (Wishlist) posts help cold start. Both need measuring.

## 5. Retention

- **Trust drives loyalty (Karrot, n=305, structural equation model, Korea, May 2022).** Trust in the platform and mutual trust among users are both direct antecedents of loyalty. Mutual trust is a strong predictor of platform trust. Economic benefit and platform functionality raise platform trust. Psychological ownership and information interactions (users sharing tips and information) raise mutual trust. Emotional interactions were not significant. No-shows did not significantly relate to either trust, which surprised the authors' own hypotheses. https://pmc.ncbi.nlm.nih.gov/articles/PMC10044753. Rating: strong as a peer-reviewed survey, but cross-sectional and self-reported, adults mostly aged 20 to 59 (students were 10.5% of the sample), not Philippine students.
- **Usage frequency benchmark.** Same sample: about 5.7 app visits per week and 2.81 trades per month on average; the paper cites that 93.3% of Karrot users are both buyers and sellers. Rating: medium (survey averages; the 93.3% is a secondary figure). Useful as an order-of-magnitude target, not a promise.
- **Ease and reach beat distrust (Facebook Marketplace).** See section 1.1; people stay because it is simple, wide and effective.
- **Notifications.**
  - Airship analysed 63 million new app users over 90 days (retail, media, sports, utility): users who got any notification retained about 3x better than opt-out or zero-send users; opted-in users who received nothing retained worse than opted-out users; more than a quarter of opted-in users got no notification in 90 days. This is correlational and from a notification vendor, from 2016 data. https://www.airship.com/newsroom/urban-airships-mobile-app-retention-study-for-key-industry-verticals/. Rating: weak to medium.
  - Airship's 2026 benchmark puts median opt-in at 53.3% on Android and 48.85% on iOS, says apps need to earn permission by timing the prompt to high-intent moments, and reports onboarding campaigns lifting opt-in up to 40% above category average. https://www.airship.com/mobile-app-push-notification-benchmarks-for-2026. Rating: weak (vendor benchmark).
  - On iPhone, web push works only for web apps added to the Home Screen (iOS 16.4 and later), and the permission request must come from a direct user action such as tapping a button. https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/. Rating: strong (first-party).
- **Keep conversations in the app.** Carousell's original comment system sent users to WhatsApp and iMessage, so the platform lost the conversation, lost the notification channel and could not follow up on failed transactions; it moved to in-app chat with read receipts, suggested messages and a shadow block for spammers. Claimed result: transaction completion time down from hours to minutes. https://get.sendbird.com/rs/047-LOL-803/images/Carousell%20Case%20Study.pdf. Rating: weak (vendor case study, no data). Consistent with SOUPS: off-platform pressure is a red flag.
- **Seller response time as a platform KPI.** Shopee Singapore tracks chat response rate and first response time as seller metrics. https://seller.shopee.sg/edu/article/50/understanding-chat-response. Rating: medium (first-party practice, no outcome data shown).
- **Students and seasonality: no rigorous evidence found.**
  - Depop is evidence that a youth-skewed resale app can scale: it reported 90% of users under 26 (https://www.wsj.com/story/generation-depop-34363ee9 and https://www.fastcompany.com/90671929/how-fashion-resale-site-depop-tapped-into-the-minds-of-gen-z, snippets only). Rating: weak.
  - Textbook trade is seasonal: a university store says the best time to sell back textbooks is the end of the semester (https://www.oswego.edu/college-store/textbook-buyback, weak), and Barnes & Noble Education's 10-Q says its results are not comparable across quarters because of seasonality (https://www.sec.gov/Archives/edgar/data/1634117/000163411724000078/bned-20240727.htm, seen as a search snippet only, weak).
  - Vendor pages claiming August move-in and graduation waves (for example https://www.heycirkle.com/use-cases/universities) are marketing (weak).
  - **Conclusion.** Plan for semester-start demand and semester-end supply as hypotheses and instrument by week of the academic term from day one.
- **Incentivised reviews do not help retention or sales** (see section 2).

## 6. Safety UX for meeting strangers

- **The risk is documented, not hypothetical.** The FBI has described armed robberies of online sellers lured to meet-ups (https://www.fbi.gov/news/stories/craigslist-robbers, strong as first-party, no rate data). This is a Craigslist case from the US; no rate for Philippine campuses is known.
- **User practices (SOUPS, CHI).** Public place, daylight, not at home, not alone, tell someone, watch for pressure to move the meeting place (section 1).
- **Platform practice (OfferUp, first-party, https://help.offerup.com/hc/en-us/articles/360032330891-Safety-tips-for-meeting-up).** Suggest official Community MeetUp Spots in the app (usually outside businesses or police stations); otherwise a busy, well-lit public place, ideally with cameras; business hours and daylight; do not share phone, email or home address and keep talking in the app; decline last-minute relocation requests; bring a friend, or tell someone the address and share location; for large items, meet at the public spot first and share the exact location only if comfortable. OfferUp announced over 450 Community MeetUp Spot signs placed with law-enforcement partners in 2017 (https://www.police1.com/police-products/communications/press-releases/offerup-announces-community-meetup-spots-program-to-encourage-secure-transactions-sCDDKi5q0XoAZlbw, snippet only).
- **Ride-hailing precedent.** Uber offers an in-app emergency button and sharing of trip status with loved ones (https://www.uber.com/us/en/newsroom/ubers-new-safety-toolkit, first-party description). SOUPS cites this as a model for second-hand platforms.
- **Effectiveness: not found.** I found no study that measures whether safe exchange zones, daytime prompts or share-your-plans features reduce incidents or raise completion rates on a marketplace. These practices are widely recommended on the strength of first-party guidance and interviews. Their effect has to be measured after launch.

## 7. Mobile and low-bandwidth

- **Tap targets.** NN/g, citing a one-handed-thumb study, recommends interactive elements of at least 1 cm by 1 cm physical size, larger for primary actions and for use while moving, and enough spacing; fingertips are 1.6 to 2 cm wide and the thumb pad about 2.5 cm. https://www.nngroup.com/articles/touch-target-size/. Rating: strong. WCAG 2.2 success criterion 2.5.8 sets a minimum of 24 by 24 CSS pixels at level AA. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html. Rating: strong (standard). One centimetre is about 38 CSS pixels (96 px per inch), so the project's 44 px rule is above both. This is arithmetic, not a source claim.
- **Speed and conversion.** Google-commissioned study by 55 and Deloitte of 37 European and American brand sites (over 30 million sessions): a 0.1 s improvement in four speed metrics gave +8.4% conversion on retail and +10.1% on travel; in retail, +3.2% progression from product list to product detail and +9.1% from detail to add-to-basket, and 9.2% higher spend. https://web.dev/case-studies/milliseconds-make-millions. Rating: medium (observational, commissioned by Google, new-goods retail, 2019 data).
- **Perceived time limits.** Nielsen's long-standing three limits: about 0.1 s feels instantaneous, about 1 s keeps the user's flow of thought, about 10 s is the limit of attention. https://www.nngroup.com/articles/response-times-3-important-limits/. Rating: medium (long-standing practitioner synthesis; I read only the summary line).
- **Philippine network speed.** Speedtest Global Index shows median mobile download in the tens of Mbps with latency around 20 to 23 ms (the page lists 66.33 Mbps and 102.27 Mbps in two blocks; I could not tell which is the latest month). https://www.speedtest.net/global-index/philippines?mobile. Rating: strong as first-party measurement. A median hides the slow tail, congested campuses and prepaid data allowances; I have no data on those here, so the low-bandwidth argument rests on inference. The Philippines research file should supply data-cost evidence.
- **Image weight.** I did not find a source on typical phone-photo upload sizes or on the effect of image weight on marketplace listing success. Treat image compression as an engineering measurement to take on real devices, not as an evidenced requirement.
- **Install and push on iPhone.** See section 5 (WebKit).

## 8. What I looked for and did not find

- A peer-reviewed study of a verified-student or campus-only marketplace (the search surfaced only student-project papers and vendor pages).
- Any effect size for identity-verification badges on P2P goods conversion.
- Evidence that safe meet-up spots, daylight prompts or share-your-plan features reduce incidents.
- Quantified listing-flow drop-off by number of fields or photos; an evidence-based optimal photo count.
- Rigorous student seasonality data for second-hand trade.
- Evidence on whether wanted-ads (Wishlist) posts help marketplace cold start.
- NN/g's "Trust and credibility" report (https://www.nngroup.com/reports/ecommerce-ux-trust-and-credibility/) is paywalled; I could read only the abstract. Baymard's product-page research was seen only as snippets.

## 9. Findings: design implications for a mobile student marketplace

Each finding states the implication, the evidence, a rating of the central evidence, and whether it is evidence-backed or a **hypothesis to measure after launch**. Existing Studiskarte behaviour is noted where it already matches.

1. **Show how many ratings and completed deals, not just the average.** Put review count and "items sold" next to the stars on profile, post page and thread header; for users with no reviews show "New" plus the verified-school mark instead of empty stars.
   - Evidence: 90%+ of Airbnb listings average 4.5 or higher so stars separate little (https://people.bu.edu/zg/publications/airbnbreviews.pdf); interviewees weigh the number of reviews over the score (https://www.usenix.org/system/files/soups2026-zarkalam.pdf); established identity earned 8.1% more but one or two negatives on a new seller did not hurt (http://presnick.people.si.umich.edu/papers/postcards).
   - Rating: **strong** (data) / medium (count over score rests on interviews and a secondary citation).
   - Type: evidence-backed. The threshold at which stars become meaningful on one campus is a **hypothesis to measure**.

2. **Hold a review back until both sides have reviewed or a window has passed, and keep reviews tied to completed deals.** The deal-gated review already matches Vinted's collusion barrier. Studiskarte reviews are currently public at once and final; consider revealing them together. On a campus where people know each other, retaliation pressure is plausibly higher than on Airbnb ([INFERENCE]). Do not pay for reviews; one reminder is enough. Consider short structured tags ("on time", "as described") in addition to stars.
   - Evidence: simultaneous reveal reduced retaliation and inflation (https://arxiv.org/pdf/2504.14053 summarising https://pubsonline.informs.org/doi/10.1287/mksc.2021.1311); incentivised first reviews produced no net benefit (https://arxiv.org/abs/2112.09783); participants hesitate to rate for safety and anonymity (https://news.ubc.ca/2024/05/facebook-marketplace-trust-issues/); predefined ratings and completed-deal gating recommended (SOUPS).
   - Rating: **strong** (two field experiments, Airbnb context) / medium (tags).
   - Type: reveal timing and no incentives are evidence-backed; the effect on a small campus graph is a **hypothesis to measure**.

3. **Ask for a short bio, not a long one, and never require a face photo.** Prompt for one or two lines (course, year, what you sell or look for). Make the profile picture optional and keep full legal names out of public view.
   - Evidence: perceived trust rises steeply from about 6 to 13 words and flattens after about 100 (https://s.tech.cornell.edu/assets/papers/ma2017airbnb.pdf); 30.7% of hosts wrote nothing; participants hide names and photos for safety, which others read as a warning (https://www.vancouverisawesome.com/highlights/do-you-use-facebook-marketplace-bc-study-suggests-trust-and-privacy-concerns-clash-8757897; SOUPS: profile picture and full name are among the most sensitive items).
   - Rating: **strong** for perceived trust in an online experiment on Airbnb profiles; no booking outcomes.
   - Type: evidence-backed on direction; the right prompt wording is a **hypothesis to measure** (bio completion rate, conversation start rate by bio present or not).

4. **Make "verified student at [school]" the primary trust mark and say how it was verified.** Reveal the fact, not the data (for example "school email checked"). Do not add more mandatory personal data until there is a reason; requests for more than expected were read as red flags. When ID verification arrives later, show it as a separate, optional second level and keep the documents with the platform only.
   - Evidence: SOUPS platform-as-escrow recommendation and the finding that excess data requests raise distrust; CHI authors recommend profile verification; school affiliation is a hard-to-fake assessment signal in the signalling-theory sense (https://s.tech.cornell.edu/assets/papers/ma2017airbnb.pdf).
   - Rating: medium. No effect size for any badge was found; vendor material is weak.
   - Type: **hypothesis to measure**: whether the verified mark raises message-to-reply and reservation rates relative to a profile without extra signals, and whether a second ID level adds anything on top.

5. **Treat reply speed as a visible trust signal and a seller habit to nudge.** Keep "typically replies within" (already hidden under 5 conversations, which avoids noisy numbers) and show it in the thread header. Consider a gentle prompt to reply to a first message, and quick-reply chips for common first messages ("Is this still available?").
   - Evidence: prompt, polite replies and good conversations reassure; delayed replies and replies at odd hours warn (CHI via https://www.vancouverisawesome.com/highlights/do-you-use-facebook-marketplace-bc-study-suggests-trust-and-privacy-concerns-clash-8757897); response time was among the strongest observational predictors of Airbnb booking success (https://www.sciencedirect.com/science/article/am/pii/S0148296321005968); Shopee tracks response rate and first response time (https://seller.shopee.sg/edu/article/50/understanding-chat-response); Carousell's suggested messages are claimed to speed conversations (https://get.sendbird.com/rs/047-LOL-803/images/Carousell%20Case%20Study.pdf).
   - Rating: medium (qualitative plus observational) / weak (suggested messages).
   - Type: showing reply time is evidence-backed; the threshold for a "fast replier" label and the effect of chips are **hypotheses to measure**. Do not penalise slow repliers in ranking until data shows reply time predicts completed deals on this platform.

6. **Require at least one real photo; guide the photo, do not chase photo count.** Coach brightness and framing at capture, and suggest one shot that shows size. Do not allow stock images as the only photo. Spend ranking and discovery effort on exposure, since views predicted sales better than image quality. There is no evidence for an optimal photo count; the 10-photo limit is a ceiling, not a target.
   - Evidence: higher image quality associated with sale, view count a better predictor, user photos beat stock for trust (https://arxiv.org/abs/1811.10648); contradictions between photos and details are a warning signal (https://www.vancouverisawesome.com/highlights/do-you-use-facebook-marketplace-bc-study-suggests-trust-and-privacy-concerns-clash-8757897); 42% of users judge size from images (https://baymard.com/blog/in-scale-product-images, snippet only).
   - Rating: **strong** (Cornell Tech) / medium (Baymard, new goods).
   - Type: evidence-backed for real photos and exposure; photo-count effect and capture-guidance uplift are **hypotheses to measure**.

7. **Make the shortest listing very short, and measure time to first listing.** A first post should need one photo, a title, a price (or "negotiable"/"free") and a category; everything else (availability days, payment ways, delivery) should have safe defaults or be deferred. The title and description are the slowest part for occasional sellers, which is what AI-assisted listing aims at (recorded as later work in the project).
   - Evidence: all friction numbers are company claims (Carousell 30 minutes to 30 seconds, https://press.carousell.com/wp-content/uploads/2022/11/thecarousellrecommerceindex-2022_en-final.pdf; Mercari 5 to 10 minutes to about 15 seconds, https://note.com/repkuririn7/n/ncf6701a10d61?hl=en); Facebook Marketplace users stay largely because setup is simple (https://news.ubc.ca/2024/05/facebook-marketplace-trust-issues/).
   - Rating: weak to medium.
   - Type: **hypothesis to measure**: median time from tapping Create to publish, share of started listings published, and share of new students who publish within 7 days, with a target set from launch data rather than from vendor claims.

8. **Launch and measure by campus, with density as the goal.** Treat one school (or one campus building cluster) as the unit; get enough fresh listings there before opening the next. Default the feed to the student's own school, keep the school filter visible, and track liquidity per school: share of listings with a message within 48 hours, share reserved within 30 days, time to first reservation, active listings per verified student.
   - Evidence: atomic network, density over size, campus-by-campus growth (https://www.lennysnewsletter.com/p/atomic-network); empty networks self-destruct (https://stripe.com/guides/atlas/andrew-chen-marketplaces); Karrot's radius and location verification (https://pmc.ncbi.nlm.nih.gov/articles/PMC10044753); liquidity ratios (https://writing.pointnine.com/p/wtf-is-marketplace-liquidity, snippet only).
   - Rating: medium (practitioner, no controlled data).
   - Type: **hypothesis to measure**: the number of active listings per school at which message and reservation rates stop rising. No source gives this number. Whether Wishlist posts help seed supply is also unmeasured; the project's decision of no automatic matching stands.

9. **Keep every conversation, offer and reservation inside the app, and make leaving look suspicious.** Hold chat, offers, handover plans and reviews in one thread so the notification channel and the report trail stay with the platform. Warn in-thread when someone asks to move to another app or to change a meeting place at the last minute, and give a one-tap report on those messages.
   - Evidence: about half of SOUPS participants used only in-platform chat for safety and treated off-platform pressure as a warning; OfferUp advises declining last-minute relocation and keeping communication in the app (https://help.offerup.com/hc/en-us/articles/360032330891-Safety-tips-for-meeting-up); Carousell lost the conversation, notifications and follow-up when chat lived in WhatsApp (https://get.sendbird.com/rs/047-LOL-803/images/Carousell%20Case%20Study.pdf).
   - Rating: medium (qualitative plus first-party guidance) / weak (vendor case).
   - Type: evidence-backed on direction; the warning wording and its report rate are **hypotheses to measure**.

10. **Earn the push permission at a high-intent moment, and make sure every opted-in student gets something useful early.** Ask after the first message sent or offer made, not at first load; explain what will be sent (replies, offers, reservation reminders). On iPhone the request has to come from a tap and only works once the app is on the Home Screen, so tie the install help to the same moment. Avoid the zero-send trap: a student who opts in and never gets a relevant alert retains worse than one who never opted in.
    - Evidence: web push constraints (https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); permission timing and zero-send retention data (https://www.airship.com/newsroom/urban-airships-mobile-app-retention-study-for-key-industry-verticals/ and https://www.airship.com/mobile-app-push-notification-benchmarks-for-2026, both vendor and correlational).
    - Rating: **strong** for the platform constraints; weak to medium for the retention effect.
    - Type: constraints are evidence-backed; the retention effect is a **hypothesis to measure**: opt-in rate by prompt moment, and 30-day retention of opted-in students with and without an alert in week one.

11. **Build retention on trust and repeat deals, not on engagement tricks; plan for the academic calendar but do not assume it.** Design so one student is naturally both buyer and seller (Karrot: 93.3% of users are both). Let trust cues (reply time, reviews, verified school) be the main reason to come back. Add a small amount of community information (for example a school's tips on safe meet-up places) because information interactions raised mutual trust in Karrot while emotional chat did not.
    - Evidence: trust to loyalty path, information interactions, 5.7 visits per week and 2.81 trades per month (https://pmc.ncbi.nlm.nih.gov/articles/PMC10044753); users stay on Facebook Marketplace because setup is easy and reach is wide (https://news.ubc.ca/2024/05/facebook-marketplace-trust-issues/); marketplace supply and demand swing by season (https://stripe.com/guides/atlas/andrew-chen-marketplaces); seasonal textbook trade (weak sources in section 5).
    - Rating: medium (cross-sectional survey, adults in Korea).
    - Type: **hypothesis to measure**: week-by-week listing and message volume across the first academic term; second-deal rate within 30 days; share of students who have both sold and bought; whether semester start raises demand and semester end raises supply. No rigorous student seasonality data exists.

12. **Make the handover step a safety feature: suggested public places, a daylight cue, and a share-my-plan button.** In the propose-a-place form, offer a short list of public spots for the student's school (gate, library, canteen, guard house) instead of only free text; show a plain note when the proposed time is after dark or far from campus; add a "Share these plans" action (name of place, time, the other student's handle) that uses the phone's share sheet so nothing needs location permission. Suggest bringing a friend for high-value items. Both people are verified students of known schools, which may lower risk compared with open marketplaces ([INFERENCE], untested).
    - Evidence: public place, daylight, not alone, tell someone (SOUPS and OfferUp); share-location precedent from ride-hailing (https://www.uber.com/us/en/newsroom/ubers-new-safety-toolkit); women report extra concern at meet-ups (https://www.vancouverisawesome.com/highlights/do-you-use-facebook-marketplace-bc-study-suggests-trust-and-privacy-concerns-clash-8757897 and SOUPS); documented robbery cases (https://www.fbi.gov/news/stories/craigslist-robbers).
    - Rating: medium (interviews and first-party guidance); no outcome evidence.
    - Type: **hypothesis to measure**: share of handovers at a suggested place, use of share-plans, and any change in cancellations or reports. The hour at which to warn is a design choice, not an evidenced threshold.

13. **Keep tap targets at or above 44 px and make primary actions larger.** The current rule already exceeds NN/g's 1 cm (about 38 CSS px) and WCAG 2.2's 24 px minimum. Give primary actions (Message, Make offer, Reserve, Confirm handover) the most room and spacing, since students use the app while walking between classes, and keep destructive actions apart from confirming ones.
    - Evidence: https://www.nngroup.com/articles/touch-target-size/; https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html.
    - Rating: **strong**.
    - Type: evidence-backed. The audit script that measures targets already covers the minimum.

14. **Budget performance on the slow tail, not the median, and measure it on real devices.** Aim for instant response to taps (about 0.1 s), a visible result within about 1 s, and never a blank wait near 10 s. Median Philippine mobile speeds are not low, so the risk is the tail: congested campus Wi-Fi, weak signal, data allowances, and old phones ([INFERENCE]; the Philippines research should confirm data-cost context). Keep reserving image space and use small, correctly sized thumbnails in the feed.
    - Evidence: 0.1 s gains moved retail conversion +8.4% in a Google-commissioned study (https://web.dev/case-studies/milliseconds-make-millions); response-time limits (https://www.nngroup.com/articles/response-times-3-important-limits/); Philippine speed medians (https://www.speedtest.net/global-index/philippines?mobile).
    - Rating: medium (retail, commissioned) / strong for the measured medians.
    - Type: **hypothesis to measure**: p75 largest-contentful-paint and interaction latency of the feed and post page on a mid-range Android phone on throttled mobile data, and image bytes per feed screen. No source was found for typical upload sizes.

## 10. What to instrument at launch

Several findings are hypotheses; they can only be settled with these numbers from the first term:

- Per school: active listings, share of listings with a message within 48 hours, share reserved within 30 days, time to first reservation.
- Per new student: time from signup to first listing, share who list in 7 days, share who message in 7 days.
- Trust: message-to-reply rate with and without bio, verified mark, reviews; share of completed deals that get a review and the average rating (to see ceiling effects).
- Safety: share of handovers at suggested places, use of share-plans, cancellations and reports by hour of day.
- Notifications: opt-in rate by prompt moment, alerts delivered per opted-in student in week one, 30-day retention by group.
- Seasonality: listings, messages and reservations by week of the academic term.
- Performance: p75 load and interaction latency on real mid-range phones; feed image bytes.
