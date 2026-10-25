/**
 * Hand-written seed texts for the corpus (issue #14): 100 original
 * Nigerian-context scam texts across the five PRD staples (bank ATS/app
 * upgrade phishing, delivery-fee, romance, investment, job_offer) plus 80
 * reworded variant templates used for threshold tuning. Variants carry only
 * a `parentKey` + `text` — category/channel/region/source are inherited from
 * the parent line at assembly time — so a paraphrase can never drift out of
 * its parent's category.
 *
 * Authoring rules (enforced by scripts/build-corpus.ts `check`):
 *   - the only `@` usage allowed is `<local>@example.com`; no other address form
 *   - phone numbers only as masked patterns (+234xxxxxxxxxx / 0803xxxxxxx)
 *   - no run of digits longer than 10 characters anywhere in a text
 *   - single-paragraph strings ≤ 990 chars; every parent text needs a `key`
 * `parentKey` values must match keys exported here or from datasets.ts.
 */
import type { Channel } from '../../../src/lib/constants';
import type { Category } from '../../../src/lib/constants';

/** One authored hand-written seed text (like datasets SeedText, plus forced key). */
export interface HandwrittenText {
  readonly key: string;
  readonly text: string;
  readonly category: Category;
  readonly channel: Channel;
  /** Popular scam → the build script samples its report_count high (25–90). */
  readonly popular?: boolean;
}

/** A reworded variant: parent's category/region/source/channel are inherited. */
export interface VariantSeed {
  /** `key` of the parent line (must exist across both source modules). */
  readonly parentKey: string;
  readonly text: string;
}

// Attribution embedded on every hand-written line (variants inherit it).
export const HANDWRITTEN_SOURCE = 'hand-written Nigerian-context seed (original, no PII)';

// — Bank ATS/app-upgrade phishing (30 = 15 sms + 15 whatsapp) —
const BANK: HandwrittenText[] = [
  { key: 'hw-bank-01', popular: true, category: 'phishing', channel: 'sms', text: "GTBANK ALERT: Dear customer, ur account will be DEACTIVATED today bcos u are yet 2 migrate 2 d new GTWorld ATS. Tap gtb-migrate.example.com/ats now 2 activate ur acct. GTBank Digital." },
  { key: 'hw-bank-02', category: 'phishing', channel: 'sms', text: "URGENT!! Ur UBA account is on temporary hold due 2 server upgrade. Reactivate via uba-reactivate.example.com/up b4 12 midnight or u lose access." },
  { key: 'hw-bank-03', category: 'phishing', channel: 'sms', text: "ACCESS BANK: Failed KYC detected on ur account. Update ur BVN-linked details at access-kyc.example.com/fix NOW 2 avoid deactivation." },
  { key: 'hw-bank-04', category: 'phishing', channel: 'sms', text: "KUDA: We noticed a login on ur acct from a new device in Lagos. No be u? Secure ur money at kuda-secure.example.com/lock b4 we freeze it." },
  { key: 'hw-bank-05', category: 'phishing', channel: 'sms', text: "OPay: Due 2 d new wallet policy, ur OPay wallet will stop working today. Upgrade free: opay-new.example.com/upgrade — takes 2 minutes." },
  { key: 'hw-bank-06', category: 'phishing', channel: 'sms', text: "Dear customer, ur ATM card is scheduled 4 deactivation due 2 d new chip migration. Reactivate: card-lift.example.com/atm — Bank Support." },
  { key: 'hw-bank-07', popular: true, category: 'phishing', channel: 'sms', text: "ALERT: A withdrawal of N85,000 was attempted on ur account. If dis was not u, cancel d transaction now at txn-cancel.example.com/stop" },
  { key: 'hw-bank-08', category: 'phishing', channel: 'sms', text: "Ur account has exceeded its transaction limit. Upgrade 2 d new tier instantly at tier-up.example.com/limit and enjoy higher transfers." },
  { key: 'hw-bank-09', category: 'phishing', channel: 'sms', text: "BANK NOTICE: Ur balance is on hold pending d annual account revalidation. Validate at revalidate-ng.example.com/year or funds will be frozen." },
  { key: 'hw-bank-10', category: 'phishing', channel: 'sms', text: "GTB: U have an unclaimed credit alert of N150,000 pending. Enter ur login at claims-gtb.example.com/credit 2 receive it b4 6pm." },
  { key: 'hw-bank-11', category: 'phishing', channel: 'sms', text: "DEAR CUSTOMER, d Central Bank has ordered all banks 2 block dormant accounts today. Keep ur account active: cbn-verify.example.com/form" },
  { key: 'hw-bank-12', category: 'phishing', channel: 'sms', text: "URGENT: The ATM PIN of ur card expires tonight. Reset instantly at pin-reset.example.com/pin or ur card stops working at dawn." },
  { key: 'hw-bank-13', category: 'phishing', channel: 'sms', text: "Notice of pending debit: N45,200 will leave ur account in 30 minutes. Wrong? Stop it now at stop-debit.example.com/reverse. Account Safety Team." },
  { key: 'hw-bank-14', popular: true, category: 'phishing', channel: 'sms', text: "Ur mobile banking token has expired. Re-enrol ur device at token-enrol.example.com/token b4 ur next login. Ignore = permanent block." },
  { key: 'hw-bank-15', category: 'phishing', channel: 'sms', text: "DEAR CUSTOMER, complete ur account upgrade 2 d new cashless policy level. Visit accts-upgrade.example.com/cashless — u will need ur card PIN. 24hrs left." },
  { key: 'hw-bank-16', category: 'phishing', channel: 'whatsapp', text: "*GTBANK UPGRADE NOTICE* Dear Esteemed Customer, GTBank has migrated 2 d new Intelligent Transaction System (ITS). All old app versions will stop working from 6pm today. Migrate at gtb-its.example.com/migrate — log in with ur account number and PIN 2 complete d upgrade. Technology Dept." },
  { key: 'hw-bank-17', category: 'phishing', channel: 'whatsapp', text: "Good day ma, dis is Mr. Emeka from d bank card unit. We discovered a failed transfer of N200,000 on ur account dis morning. I will help u reverse it. Just send d OTP dey sent 2 ur fone now so I confirm u are d owner. Its urgent bcos d money dey enter another person acct." },
  { key: 'hw-bank-18', category: 'phishing', channel: 'whatsapp', text: "Hello, I dey call from d fraud monitoring unit. Somebody is trying 2 empty ur account as we dey talk. 2 secure am, tell me ur card number, expiring date and d last 3 digits at d back make I block d thief transaction." },
  { key: 'hw-bank-19', category: 'phishing', channel: 'whatsapp', text: "*URGENT ACCOUNT REACTIVATION* Dear Customer, ur account (0123 4567 89) was flagged during our system migration and is now RESTRICTED. Reactivate within 4 hours at acct-reactive.example.com/limit. Login: account number + PIN. Signed: Migration Unit." },
  { key: 'hw-bank-20', category: 'phishing', channel: 'whatsapp', text: "Hi ma, its Amaka from customer care o. We saw dat ur transfer of N37,500 to Mrs. Kemi Balogun was debited twice. Click refund-desk.example.com/double 2 fetch ur refund and enter ur PIN so d alert go drop." },
  { key: 'hw-bank-21', category: 'phishing', channel: 'whatsapp', text: "*BANK OF TRUST* Ur dormant account don earn interest of N96,000. Claim am b4 acct closure: dorm-claim.example.com/interest — supply ur acct number and BVN." },
  { key: 'hw-bank-22', category: 'phishing', channel: 'whatsapp', text: "Good afternoon sir. Dis is d KYC compliance desk. Ur BVN will be de-linked from ur account bcos of incomplete records. Send ur BVN and date of birth here make I complete am 4 u b4 4pm. Thanks." },
  { key: 'hw-bank-23', category: 'phishing', channel: 'whatsapp', text: "*NOTICE OF ACCOUNT SUSPENSION* Dear Customer, due 2 d new eNaira compliance directive, accounts without biometric update will be closed on Friday. Do ur biometric update online at bio-update.example.com/ekyc — e no pass 2 minutes. Signed: Digital Banking." },
  { key: 'hw-bank-24', category: 'phishing', channel: 'whatsapp', text: "Madam good afternoon, dis is d inter-switch settlement unit. Ur POS machine received N310,000 by mistake. D money must return today or our auditor go debit ur main acct. Text ur account details here make we process d reversal." },
  { key: 'hw-bank-25', category: 'phishing', channel: 'whatsapp', text: "Hello sir, I dey d card production section. Ur new card is ready but dispatch was returned. Confirm ur full address and card PIN on cardpay.example.com/verify so d courier fit deliver am tomorrow morning." },
  { key: 'hw-bank-26', category: 'phishing', channel: 'whatsapp', text: "*SECURITY BREACH* 3 failed login attempts recorded on ur bank profile from a device in Abuja. Ur account go lock in 2 hours. Secure am: netguard.example.com/lock" },
  { key: 'hw-bank-27', category: 'phishing', channel: 'whatsapp', text: "Dear Customer, d monthly dormancy charge of N1,000 on ur savings account failed bcos of insufficient balance. Fund am or ur acct closes today. Pay: dorm-pay.example.com/charge" },
  { key: 'hw-bank-28', category: 'phishing', channel: 'whatsapp', text: "I no fit call u now. Just see am: ur salary acct is among d ones CBN froze dis morning over wrong BVN records. Open cbn-bvn.example.com/unfreeze, enter ur details, make dem release am b4 friday o." },
  { key: 'hw-bank-29', category: 'phishing', channel: 'whatsapp', text: "Small business owner! Ur business account qualifies 4 d new cashflow boost of N300,000. Registration closes today: biz-cash.example.com/form — supply ur acct login and PIN 2 enrol instantly." },
  { key: 'hw-bank-30', category: 'phishing', channel: 'whatsapp', text: "Attention! Ur bank profile dey among d 2,000 accounts wey d anti-fraud system flagged. Clear ur name b4 8pm at fraud-clear.example.com/clear else d acct go seize. Send ur transaction PIN after verification." },
];

// — Delivery-fee scams (20 = 10 sms + 10 whatsapp) —
const DELIVERY: HandwrittenText[] = [
  { key: 'hw-del-01', popular: true, category: 'delivery', channel: 'sms', text: "GIG EXPRESS: Ur parcel GY-7741-LOS don arrive at d Ikorodu hub but delivery fee of N2,800 never paid. Pay here: gig-fee.example.com/pay make we deliver am today." },
  { key: 'hw-del-02', category: 'delivery', channel: 'sms', text: "DHD COURIER: Package DH-8842-NGA is held at d airport warehouse. Delivery clearance fee N4,500 unpaid. Settle at dhd-clear.example.com/fee b4 48hrs or package returns 2 sender." },
  { key: 'hw-del-03', category: 'delivery', channel: 'sms', text: "SHOPFAST: Ur order 4412-88 is ready 4 delivery but d address service fee of N1,900 is pending. Confirm and pay: shopfast-fee.example.com/confirm" },
  { key: 'hw-del-04', category: 'delivery', channel: 'sms', text: "Your package from d UK is with customs at d port. Clearance fee is N18,500. Pay customsclear.example.com/nga b4 dem seize am o. Courier Desk." },
  { key: 'hw-del-05', category: 'delivery', channel: 'sms', text: "Kwik Delivery: rider dey wait with ur parcel in front of ur street but d sender no pay d full delivery fee of N2,300. Pay kwikpay.example.com/fee make e deliver now." },
  { key: 'hw-del-06', category: 'delivery', channel: 'sms', text: "PARCEL ALERT: We could not deliver ur package today, nobody home. Reschedule and pay d N2,000 redelivery fee at redeliver.example.com/book or we return am on Friday." },
  { key: 'hw-del-07', category: 'delivery', channel: 'sms', text: "Delivery failed! Wrong house number given 4 order 22231. Update ur address + pay N1,500 correction fee: fixaddress.example.com/update" },
  { key: 'hw-del-08', popular: true, category: 'delivery', channel: 'sms', text: "UR parcel don land! Collect am today b4 5pm @ d pickup station — but first settle d unclaimed storage fee of N3,200: storage-fee.example.com/pay" },
  { key: 'hw-del-09', category: 'delivery', channel: 'sms', text: "NIS CUSTOMS: A package in ur name was intercepted with items above duty-free limit. Pay duty of N25,000 at duty-desk.example.com/pay within 24hrs or face seizure." },
  { key: 'hw-del-10', category: 'delivery', channel: 'sms', text: "Dear customer, ur parcel is on d way but our rider needs d balance of d shipping fee (N4,000). Send am via d app link: balance-fee.example.com/topup" },
  { key: 'hw-del-11', category: 'delivery', channel: 'whatsapp', text: "Good morning ma. Dispatch rider here with ur parcel from Computer Village. D sender only paid 4 d item, no pay delivery. Send N3,000 to my rider account 0123 4567 89 (moniepoint) and I deliver am in 10mins. Thanks." },
  { key: 'hw-del-12', category: 'delivery', channel: 'whatsapp', text: "Hello sir, na me dey hold ur waybill 5509-21. D warehouse say make dem return am tomorrow morning cos of unpaid storage. Just pay d N2,500 here: waybill-pay.example.com/fee and I go bring am tonight." },
  { key: 'hw-del-13', category: 'delivery', channel: 'whatsapp', text: "Madam, ur box from abroad is stuck at d airport. Customs dey ask 4 parcel inspection fee of N15,000. If u no pay before Friday, dem go open d box. Make we settle am: inspection-fee.example.com/customs" },
  { key: 'hw-del-14', category: 'delivery', channel: 'whatsapp', text: "Hi! Ur delivery from Abuja is scheduled 4 today. Our system shows delivery fee N3,500 unpaid. Complete d payment on delivery-pay.example.com/settle so driver no go cancel ur trip." },
  { key: 'hw-del-15', category: 'delivery', channel: 'whatsapp', text: "Brother, d parcel wey u send give ur mum for Kaduna don dey return back cos d courier fee of N2,700 no complete. Pay dis one make e go: courier-topup.example.com/send" },
  { key: 'hw-del-16', category: 'delivery', channel: 'whatsapp', text: "URGENT DELIVERY NOTICE: Ur package cannot clear d shipping gate without d insurance upgrade fee of N6,000 — bcos e contain electronics. Pay: gate-insure.example.com/fee — 1hr left o." },
  { key: 'hw-del-17', category: 'delivery', channel: 'whatsapp', text: "Good day, dis is d delivery manager for ur area. We get 2 parcels 4 u but d first rider carry package wey no pay service charge. Confirm ur parcel + pay service charge of N2,000: service-charge.example.com/pay" },
  { key: 'hw-del-18', category: 'delivery', channel: 'whatsapp', text: "Hello, ur consignment don reach d last bus-stop, but warehouse fee of N1,800 dey hang am. Drop d fee here: warehousefee.example.com/pay before 6pm or dem go re-book am next week." },
  { key: 'hw-del-19', category: 'delivery', channel: 'whatsapp', text: "Madam ur 25kg bag of rice from d market donated group is ready but delivery van money never enter (N4,200). Send am urgent: van-fee.example.com/pay and we go deliver dis morning." },
  { key: 'hw-del-20', category: 'delivery', channel: 'whatsapp', text: "Sir I dey disturb u like dis bcos ur parcel is d last one for my van and I dey close. Just settle d remaining N1,200 delivery balance on riderbalance.example.com/pay make I drop am b4 I go." },
];

// — Romance scams (20 = 12 whatsapp + 8 email) —
const ROMANCE: HandwrittenText[] = [
  { key: 'hw-rom-01', popular: true, category: 'romance', channel: 'whatsapp', text: "My queen, I dey my rig alone again dis night and all I see na ur face. D contract suppose end in November but dem add 3 months. I dey count days. When I come back, na only u and me. Kisses my love." },
  { key: 'hw-rom-02', category: 'romance', channel: 'whatsapp', text: "Good morning my angel. I fit call u on video tonight? Network here for offshore dey poor but I go try. I just want hear ur voice b4 I sleep. Hope u no go ever leave me." },
  { key: 'hw-rom-03', category: 'romance', channel: 'whatsapp', text: "My love, I broke down small today thinking about us. Everything I dey do na for our future. Dat house u like for Lekki, dem don start to build am. Just 6 more months, I promise." },
  { key: 'hw-rom-04', category: 'romance', channel: 'whatsapp', text: "Baby, I no fit believe say u exist. U complete me. Dis week my supervisor dey talk say two engineers fit come home early next month, so I go apply faster make I fit look ur eyes face to face." },
  { key: 'hw-rom-05', category: 'romance', channel: 'whatsapp', text: "My sweetheart, I dey send u dis from d helipad deck. I tell God say if he keep me dis shift, na u I go marry. I mean am. I don even tell my mama about u. She say she wan see ur picture." },
  { key: 'hw-rom-06', category: 'romance', channel: 'whatsapp', text: "Good evening my queen. How was ur day? Mine long but thinking of u dey calm me. I don pack all my leave for December so we fit spend am together with ur family. U go like my mama, she serious like u." },
  { key: 'hw-rom-07', category: 'romance', channel: 'whatsapp', text: "My love, I dreamed of u and woke with tears. Dis oil rig life is lonely without u. Give me strength, tell me u will wait. My whole estate na for u: my pension, my house, my life." },
  { key: 'hw-rom-08', category: 'romance', channel: 'whatsapp', text: "Darling, no vex I couldnt video call. D network here dey expensive and slow, I dey use small small data bundles. Send me 5,000 for better data make I dey see ur face every night, I beg u my heart." },
  { key: 'hw-rom-09', popular: true, category: 'romance', channel: 'whatsapp', text: "My dearest, I never stop thanking God for d day I met u. When I land, I go come do proper introduction with my family elders. U are my answered prayer. Never doubt me, I no be like d others wey hurt u." },
  { key: 'hw-rom-10', category: 'romance', channel: 'whatsapp', text: "Sweetheart, I know say u don wait long. D company don fix my flight 4 next month but dem say I must clear my medicals and visa fee of 250,000 first. Once I pay, nothing fit stop me again. I dey arrange am." },
  { key: 'hw-rom-11', category: 'romance', channel: 'whatsapp', text: "My love abeg no vex for me. I promise dis will be d last Christmas wey we go spend apart. Next year dis time, na our parlour u dey cook for. Just hold on small for me my angel." },
  { key: 'hw-rom-12', category: 'romance', channel: 'whatsapp', text: "Goodnight my treasure. I dey on night shift and my heart is with u. Tomorrow na pay roll, I go send u 30,000 make u buy something fine 4 urself. Who get me get everything wan be urs." },
  { key: 'hw-rom-13', category: 'romance', channel: 'email', text: "My Dearest, I hope dis letter finds u well. My name is Engr. Mark Obi, contract engineer stationed on an oil platform in d atlantic. I am a widower with one daughter in boarding school overseas. A colleague introduced ur profile 2 me and since den I have not been able 2 sleep without thinking of u. I know dis is sudden, but at my age I have no time 4 games. If u will let me, I want 2 make u my queen. My contract ends in a few months and I am coming home finally. Yours, Mark." },
  { key: 'hw-rom-14', category: 'romance', channel: 'email', text: "From d desk of Lt. Col. Richard Cole (rtd). Dear friend, I write u with a heavy heart and a hopeful one. I am a military officer serving in an international mission, far from home, and my marriage ended while I was away. Seeing ur details on d humanitarian register reminded me dat life still has hope. I plan 2 retire after dis deployment and settle in my hometown. If u believe in second chance as I do, reply me so we can talk properly. Richard." },
  { key: 'hw-rom-15', category: 'romance', channel: 'email', text: "Dearest one, forgive my long silence. Our pipeline project moved 2 d desert depot where network is a luxury. I have carried dat picture of us on my fone through every storm. D company owes us 3 months allowances and when dem pay I will come straight 2 meet ur family. All I ask is patience and prayers. No man fit love u like I do. Chuka." },
  { key: 'hw-rom-16', category: 'romance', channel: 'email', text: "Hello dear, it is with joy I write u tonight. I am a medical doctor working with d field hospital in d peace-keeping region. I lost my wife 2 illness four years ago and since dat day my life has been d hospital alone. Watching u speak about ur late parents broke my heart. Two people dat know what loss means, walking together and healing each other. I am due 4 leave in May. May I come and see u? Dr. Emeka Ade." },
  { key: 'hw-rom-17', category: 'romance', channel: 'email', text: "My darling, I have 2 tell u something. D engineers union disrupted our rotation so d vessel stays another 6 weeks. I was angry upon angry until I remembered I have u. U are d reason I still smile in dat lonely sea. One day dis sacrifice go make sense. Keep my pictures close and my word closer. Ur one and only." },
  { key: 'hw-rom-18', category: 'romance', channel: 'email', text: "Dearest, d bank called me yesterday about my severance account. I retired quietly after 28 years in d marine sector and now I want only one thing: a companion 2 share my estate with. I saw ur kind profile and felt peace. I am not a young man but my heart is correct and my intentions are honourable. If u are willing, we can start with friendship and prayer. Reply when u read. Pa Danjuma." },
  { key: 'hw-rom-19', category: 'romance', channel: 'email', text: "My heart, forgive me 4 writing late at night. D storm disconnected our platform cluster twice dis week and I have not set my eyes on ur messages. Reading ur last letter under my bunk lamp na d only light I had. I am counting 47 days 2 touchdown. When I come, everything good: ring, family, everything. Wait 4 me my angel." },
  { key: 'hw-rom-20', category: 'romance', channel: 'email', text: "Dear one, I am a widowed businessman in d agro export trade between here and d far north. My late wife left me with no children, only d markets I dey manage. A trusted nun recommended I seek companionship among women of faith and ur smile over d video call was like sunrise. I will be honest: my age is 58, my heart is sincere, and my plans include travel and a quiet home. May I know u better? Chief Sylvanus." },
];

// — Investment scams (15 = 6 whatsapp + 4 sms + 5 email) —
const INVESTMENT: HandwrittenText[] = [
  { key: 'hw-inv-01', popular: true, category: 'investment', channel: 'whatsapp', text: "Sis see wetin my team do last month: N480,000 profit from d AGR platform in just 6 weeks. U can start with 50k and d team handles everything. Registration closes friday: agr-team.example.com/join" },
  { key: 'hw-inv-02', category: 'investment', channel: 'whatsapp', text: "Bro d forex community is paying again o! My own payout dropped dis morning: N95,000. U know I no fit hide am from u. New team opens mid-month, slots dey cost 100k. U wan hear d breakdown?" },
  { key: 'hw-inv-03', category: 'investment', channel: 'whatsapp', text: "Good news everywhere! D crypto mining box dey double every deposit in 21 days. I put 150k last month and now I dey reinvest d profit. Jump on dis one b4 d slots finish: mine-double.example.com/start" },
  { key: 'hw-inv-04', category: 'investment', channel: 'whatsapp', text: "Tell ur people make dem no miss am: our palm oil warehouse scheme dey pay 30 percent every quarter, receipts and insurance included. Last quarter me alone collect N210,000. Next cycle closes dis week." },
  { key: 'hw-inv-05', category: 'investment', channel: 'whatsapp', text: "I don enter d daily signal group. N50k weekly return on small capital, no need 2 learn chart, na expert traders dey trade. My own platform: signal-kings.example.com/vip" },
  { key: 'hw-inv-06', popular: true, category: 'investment', channel: 'whatsapp', text: "*FINANCIAL FREEDOM* D new cassava processing investment don open. 10 slots per street and my street don fill 7 already. N250k returns N80k monthly 4 six months. Pay-in closes today 5pm: farmvault.example.com/invest" },
  { key: 'hw-inv-07', category: 'investment', channel: 'sms', text: "D doubler club pays again! Every N100,000 doubles in 30 days on our books. We don do 4 straight cycles. SMS ur name 4 d next slot: 0803xxxxxxx. Fast!" },
  { key: 'hw-inv-08', category: 'investment', channel: 'sms', text: "AGR BOOM: earn 30k weekly on 100k stake, six straight weeks, paid every friday. Next boarding starts 2moro, few slots: agrdaily.example.com/earn" },
  { key: 'hw-inv-09', category: 'investment', channel: 'sms', text: "Crypto alarm: BTC dey pump and our AI terminal dey catch every wave. Members don cash out N2.4m dis month. Join at aibots.example.com/trade — free demo 4 first 100 users." },
  { key: 'hw-inv-10', category: 'investment', channel: 'sms', text: "Wealth note: turn 500k into 1.4m in 90 days with our bonded warehouse receipt scheme. Insured and receipt-backed. SMS 4 d prospectus: 0705xxxxxxx." },
  { key: 'hw-inv-11', category: 'investment', channel: 'email', text: "Dear Investor, our unit trust returned 34 percent in d last fiscal year, outperforming every pension fund in d region. Entries into d next window close on Friday with minimum 250,000. Reply 4 d fact sheet and call schedule. CrestHill Capital." },
  { key: 'hw-inv-12', category: 'investment', channel: 'email', text: "Dear ma, thank u 4 attending our webinar. As promised, d private placement allocation of d tech logistics company is now open 2 our circle: 40,000 units at N5.20, projected listing at N14.50. Allocation is first-come. Kindly indicate ur interest b4 d close-out. Investor Relations, CrestHill Capital." },
  { key: 'hw-inv-13', category: 'investment', channel: 'email', text: "Introducing d community grain bank: buy bags of maize at harvest price, store in our bonded silo and sell at dry-season premium. Average member return last season: 41 percent. Insurance against pests is fully covered. Mentorship included 4 first-timers. Reply 2 join d next intake." },
  { key: 'hw-inv-14', category: 'investment', channel: 'email', text: "URGENT PRIVATE INVITATION: we are acquiring stressed commercial papers at 60 cents on d dollar. Historical recovery in our last 3 cycles: 100 cents plus 18 percent premium. Our circle of 35 investors raised 96 million last cycle; 4 slots remain. Dis is a private letter, reply by d weekend." },
  { key: 'hw-inv-15', category: 'investment', channel: 'email', text: "Dear Client, our diversified digital asset basket has delivered 27 percent year to date with daily risk controls. A new rebalanced basket opens Monday, minimum 500,000. Existing clients keep 2 percent management fee 4 life if d entry is dis window. Secure ur slot." },
];

// — Job-offer scams (15 = 6 whatsapp + 4 sms + 5 email) —
const JOB: HandwrittenText[] = [
  { key: 'hw-job-01', category: 'job_offer', channel: 'whatsapp', text: "URGENT RECRUITMENT! New supermarket opening in Ikeja needs 25 sales staff. Pay N90,000 monthly. Send CV 2 careers@example.com b4 friday. Registration fee of N2,000 happens after d interview only." },
  { key: 'hw-job-02', category: 'job_offer', channel: 'whatsapp', text: "Home service cleaners needed in Lekki phase 1. 4 positions, N80k monthly plus transport allowance. Applications close 6pm today. Send name, area and fone number here and pay d N1,500 file fee 2 secure an interview slot." },
  { key: 'hw-job-03', popular: true, category: 'job_offer', channel: 'whatsapp', text: "Data entry work from fone: earn N5,000 daily typing at home. No experience, no CV needed. Start-up training kit is N4,500 one time. Chat me back START make I reserve ur slot. Slots dey finish o." },
  { key: 'hw-job-04', category: 'job_offer', channel: 'whatsapp', text: "Good news! D hospital admin is recruiting 8 admin assistants (SSCE or BSC). Salary N120,000. Interview is dis saturday 9am. But u need 2 register 4 d work profile first: staffhire.example.com/reg (N3,000)." },
  { key: 'hw-job-05', category: 'job_offer', channel: 'whatsapp', text: "Dispatch riders needed! Own bike, own phone. Daily returns N8,000 on our three routes around Yaba. Send licence and means of ID 2 our WhatsApp HR line. Registration N7,500 covers ur rider vest and tracking app." },
  { key: 'hw-job-06', category: 'job_offer', channel: 'whatsapp', text: "MASSIVE HIRING ALERT: A new bank service outlet in Surulere dey recruit customer assistants on contract, N110k basic plus bonus. To apply, sign up on hirepoint.example.com/bank (one-time N2,500 portal charge). Closing date: wednesday night." },
  { key: 'hw-job-07', category: 'job_offer', channel: 'sms', text: "JOB OFFER: Filling station attendant positions open in Ogun state. N85k monthly. SMS ur qualification 2 0810xxxxxxx. Application fee N2,000 via d portal link." },
  { key: 'hw-job-08', category: 'job_offer', channel: 'sms', text: "Earn 60k weekly packaging socks from home. Free training video, kit fee N5,500 refundable after ur first order. Call d supervisor on 0902xxxxxxx 2 begin dis week." },
  { key: 'hw-job-09', category: 'job_offer', channel: 'sms', text: "BD roles at a new fintech in VI. Salary N250k. BSC plus 2 yrs experience. SMS CV summary 2 0814xxxxxxx and pay d N3,000 aptitude test token on d listed account." },
  { key: 'hw-job-10', category: 'job_offer', channel: 'sms', text: "Festival stewards needed 4 d December show at d tent grounds. 3 days work, N25,000. Only 40 slots. Register at eventstaff.example.com/form — processing N1,000." },
  { key: 'hw-job-11', category: 'job_offer', channel: 'email', text: "Dear Applicant, following ur application, u are shortlisted 4 d Operations Assistant role at our head office. Interview holds friday 11am via video call. Kindly complete ur candidate file processing (N4,000) on talentgate.example.com/fee b4 thursday so ur panel slot can be booked. HR Manager." },
  { key: 'hw-job-12', category: 'job_offer', channel: 'email', text: "Hi, I saw ur profile on d job board and I think u fit our growing telesales team. We pay 100k base plus 15k airtime monthly, with commission topping 40k. Immediate start monday. 2 enrol, pay d recruitment compliance fee of N6,500 2 d account d acceptance mail will carry. Congratulations in advance. Gbenga, Talent Lead." },
  { key: 'hw-job-13', category: 'job_offer', channel: 'email', text: "Dear Candidate, d dispatch training school affiliated with our logistics firm is admitting d November intake. Graduates are auto-deployed 2 paying routes (min 80k monthly). Tuition: N15,000, coveralls inclusive. Reply 2 secure 1 of d 12 seats. Placement Officer." },
  { key: 'hw-job-14', category: 'job_offer', channel: 'email', text: "URGENT: D hospitality group seeks 10 kitchen porters and 6 front-desk staff across 3 properties in Abuja. Pay: N75k to 95k with staff meal. Applications open 48 hours. Shortlisted candidates pay a N2,000 background check. Apply: hotelfill.example.com/apply" },
  { key: 'hw-job-15', category: 'job_offer', channel: 'email', text: "Good day ma. Our NGO has 3 funded positions: community mobiliser, data clerk and field driver. Salaried with health cover. D sponsor requires a processing caution fee of N3,500 from candidates (refundable 4 d hired). Send ur CV as reply. Programme Officer." },
];

/** All 100 hand-written parents, in fixed assembly order (bank, delivery, romance, investment, job). */
export const HANDWRITTEN = [...BANK, ...DELIVERY, ...ROMANCE, ...INVESTMENT, ...JOB] as const;

// — Reworded variants (80). Paraphrase surface only: typos, casing, pidgin,
// swapped amounts, emoji-free urgency. Category/region/source/channel inherit
// from the parent at build time; only text is authored here. —
const HANDWRITTEN_VARIANTS: VariantSeed[] = [
  // bank ATS/app upgrade (12)
  { parentKey: 'hw-bank-02', text: "UBA ALERT!! UR ACCT IS ON HOLD O. Server upgrade go finish today. If u no want lose access, quick reactivate: uba-reactivate.example.com/up b4 12 midnite!!!" },
  { parentKey: 'hw-bank-03', text: "Access Bank: KYC wahala dey ur acct! Dey go freeze am soon. Update ur BVN details sharp sharp at access-kyc.example.com/fix NOW NOW." },
  { parentKey: 'hw-bank-05', text: "Opay wallet don expire o!! Today na d final day. Old wallet no go send or collect money again. Upgrade free here: opay-new.example.com/upgrade" },
  { parentKey: 'hw-bank-06', text: "Customer Service: Ur ATM card don enter deactivation list. Reactivation takes 2mins: card-lift.example.com/atm. Do am b4 ur card stop working." },
  { parentKey: 'hw-bank-08', text: "TRANSACTION LIMIT REACHED. Ur acct dey due 4 tier upgrade. Higher transfers dey wait u. Activate: tier-up.example.com/limit — 24hrs remaining only." },
  { parentKey: 'hw-bank-10', text: "GTB CREDIT ALERT PENDING: d N150,000 wey dem wan pay u dey hang. Enter ur login quickly at claims-gtb.example.com/credit make e drop b4 6pm." },
  { parentKey: 'hw-bank-11', text: "BREAKING: CBN orders banks 2 close ALL dormant accts today!! Do ur reactivation 4 free: cbn-verify.example.com/form. Disregard if done." },
  { parentKey: 'hw-bank-13', text: "DEBIT WARNING: N45,200 go comot 4rm ur acct in 30mins! No be u? Reverse am sharp at stop-debit.example.com/reverse b4 e disappear." },
  { parentKey: 'hw-bank-16', text: "*GTBANK ITS MIGRATION* Dear Customer, d old app go off 6PM sharp. Login with acct no + PIN at gtb-its.example.com/migrate 2 finish upgrade. Tech Dept. Pls disregard earlier mails." },
  { parentKey: 'hw-bank-19', text: "*ACCT RESTRICTED* Migration flag ur account (0123 4567 89). Reactivation window: 4 hours only. acct-reactive.example.com/limit. Use acct number + PIN." },
  { parentKey: 'hw-bank-23', text: "*E-NAIRA DIRECTIVE* All accounts without biometric update go be CLOSED on Friday o. Complete urs in 2 minutes: bio-update.example.com/ekyc. Digital Banking." },
  { parentKey: 'hw-bank-27', text: "DORMANCY CHARGE FAILED: N1,000 no enter. Ur savings acct dey due 4 closure today. Pay here 2 save am: dorm-pay.example.com/charge" },
  // delivery-fee (8)
  { parentKey: 'hw-del-02', text: "Parcel DH-8842-NGA still dey warehouse!! Clearance fee N4,500 no paid o. 48hrs and dem go return am. Pay: dhd-clear.example.com/fee" },
  { parentKey: 'hw-del-03', text: "SHOPFAST: Order 4412-88 ready 2 drop but d small deliver fee N1,900 dey owed. Confirm + pay here make rider boost: shopfast-fee.example.com/confirm" },
  { parentKey: 'hw-del-05', text: "Rider dey ur street NOW with ur parcel but sender no pay full fee (N2,300). Pay kwikpay.example.com/fee sharp sharp make e no go back." },
  { parentKey: 'hw-del-07', text: "Delivery fail!! Order 22231 no fit drop bcos address no correct. Fix am + N1,500 correction fee: fixaddress.example.com/update b4 refund window close." },
  { parentKey: 'hw-del-11', text: "Morning ma! I don reach ur gate with d parcel from Computer Village. Sender no pay delivery o — N3,000 to 0123 4567 89 (moniepoint) and I drop am in 10mins. Thanks!" },
  { parentKey: 'hw-del-13', text: "URGENT!! Ur box dey stuck for airport, customs dey demand N15,000 inspection fee. If u no pay b4 Friday dem go open am. inspection-fee.example.com/customs" },
  { parentKey: 'hw-del-16', text: "1 HOUR LEFT: package no clear bcos insurance upgrade (N6,000) never paid. Electronics inside na d reason. gate-insure.example.com/fee" },
  { parentKey: 'hw-del-18', text: "Ur consignment don reach last stop but warehouse owing N1,800 dey hang am. Pay b4 6pm or re-book next week: warehousefee.example.com/pay" },
  // romance (8)
  { parentKey: 'hw-rom-02', text: "My angel try call me tonight na beg. Network here poor small but I must see ur face. Hope u no go ever leave me o. Kisses." },
  { parentKey: 'hw-rom-04', text: "Baby u complete me too much! D application for early leave don enter. Pray make dem approve am, two weeks from now I go look ur eyes face to face." },
  { parentKey: 'hw-rom-05', text: "My sweetheart!! I just finish my annual appraisal and I tell my supervisor say I get wife material at home wey dey wait me. She laugh. I no dey joke with u." },
  { parentKey: 'hw-rom-07', text: "I wake up 3am with tears from dream about u. Dis rig life lonely die. Tell me say u go wait 4 me, my whole estate na 4 u my love." },
  { parentKey: 'hw-rom-10', text: "Sweetheart d visa thing don reach final stage!! I go book my medical dis week and once I pay d 250,000, NOTHING go stop us again. I dey arrange am." },
  { parentKey: 'hw-rom-13', text: "My Dearest, dis na Engr. Mark again. D platform dey noisy but ur thought calm me. My contract don dey wind down finally and I dey come home 4 good. My heart belong 2 u alone. Reply me make I sleep well." },
  { parentKey: 'hw-rom-15', text: "Dearest one, network no good for dis desert depot at all. I dey carry ur picture everywhere like passport. D allowances don dey process, soon I go face ur family proper. No man fit love u like I do." },
  { parentKey: 'hw-rom-18', text: "Dearest, I read ur reply THREE times last night. At my age I no get business with games: my heart is correct, my intentions honourable. Friendship first, prayer join am. Reply when u read. Pa Danjuma." },
  // investment (7)
  { parentKey: 'hw-inv-02', text: "Bro!! My forex payout drop again o, N95,000 dis morning alone. D new team go open mid month, slots na 100k. U dey follow me or I let am go?" },
  { parentKey: 'hw-inv-03', text: "D mining box don double my 150k in 21 days straight! I don reinvest d profit join. Jump on am now b4 slots finish: mine-double.example.com/start" },
  { parentKey: 'hw-inv-04', text: "Palm oil scheme update: 30 percent every quarter, insurance and receipts dey intact. Me alone carry N210,000 last quarter. Cycle dey close dis week o." },
  { parentKey: 'hw-inv-07', text: "Doubler club alert: every 100k turns 200k in 30 days!! 4 correct cycles done. SMS 0803xxxxxxx 4 d next slot, e dey finish fast." },
  { parentKey: 'hw-inv-09', text: "BTC dey pump again and our AI terminal dey catch wave after wave. Members don cash N2.4m dis month. Free demo 4 first 100 people: aibots.example.com/trade" },
  { parentKey: 'hw-inv-12', text: "Reminder ma: d private placement (40k units at N5.20, listing projection N14.50) allocation dey close tomorrow. First come first serve. Kindly indicate b4 close-out. CrestHill IR." },
  { parentKey: 'hw-inv-14', text: "PRIVATE CIRCLE UPDATE: stressed papers buying don open 4 d last 4 slots. Last 3 cycles recover 100 cents plus 18 percent premium. Reply b4 weekend abeg." },
  // job_offer (5)
  { parentKey: 'hw-job-01', text: "HIRING HIRING!! 25 sales staff needed 4 d new Ikeja supermarket (90k monthly). Send CV 2 careers@example.com b4 Friday. N2,000 registration na after interview only." },
  { parentKey: 'hw-job-04', text: "Hospital recruitment: 8 admin assistants wanted (120k salary). Interview na saturday 9am sharp. First register staffhire.example.com/reg (N3,000) or ur name no go dey d list." },
  { parentKey: 'hw-job-06', text: "Bank outlet for Surulere dey hire contract customer assistants, N110k basic + bonus. Portal charge N2,500 once: hirepoint.example.com/bank. Closing na Wednesday night o." },
  { parentKey: 'hw-job-08', text: "Pack socks from home, cash out 60k weekly. Kit fee N5,500 refundable. Call supervisor 0902xxxxxxx make u start dis week." },
  { parentKey: 'hw-job-11', text: "Good news! U don shortlist 4 d Operations Assistant role o. Video interview friday 11am. Just process ur candidate file (N4,000) on talentgate.example.com/fee b4 thursday make dey book ur panel." },
  // UCI-style dataset parents (14)
  { parentKey: 'uci-vp-01', text: "U WIN!!! Brand new car enter ur name 4 d annual phone draw o! Quick send ur full name and where u stay make dem deliver am." },
  { parentKey: 'uci-vp-02', text: "FREE RINGTONE 4 U YES YES! Reply YES make we fling d top chart tones enter ur fone dis week, no charge at all!" },
  { parentKey: 'uci-vp-03', text: "Lonely singles dey ur area dey wait 2 chat 2nite o! Call 0703xxxxxxx fast, first 5 minutes na free!" },
  { parentKey: 'uci-vp-04', text: "CLAIMS LINE: ur prize don dey wait! Call 0871xxxxxxx between 9am and 7pm sharp. If u no claim b4 close e go pour away." },
  { parentKey: 'uci-vp-05', text: "Singles 4 ur postcode dey hot today! Send CHAT 2 6xxxx, match dey land instant. 18plus!" },
  { parentKey: 'uci-vp-06', text: "JACKPOT ALERT: one million naira don fall on ur line dis month! SMS ur name + location to 33xxx. Fifty naira per SMS, terms apply." },
  { parentKey: 'uci-vp-07', text: "CONGRATS!!! D MONI promo choose u o — ur 200,000 cash dey ready. Call 0810xxxxxxx NOW 2 collect." },
  { parentKey: 'uci-vp-08', text: "New friends dey wait! Send FRIEND 2 7xxxx, chat start instant 2nite. Normal rates." },
  { parentKey: 'uci-vp-09', text: "UR OUR 1000TH CALLER! Brand new TV dey ur name. Call back d promo line within 10 minutes make u no loss am!" },
  { parentKey: 'uci-vp-10', text: "U DON WIN 2 VIP TICKETS 4 d city carnival!! Show dis msg at d gate with ur ID b4 friday. Enjoy!!" },
  { parentKey: 'uci-vp-11', text: "LIFE COVER from just 1,500 monthly!! SMS name + age 2 40xxx, agent go flash u back." },
  { parentKey: 'uci-vp-12', text: "RECHARGE & WIN: ur line pick 4 d promo o. Call d claims agent 0813xxxxxxx with ur winning PIN sharp." },
  { parentKey: 'uci-vp-13', text: "QUIZ: wetin be capital of Japan? A Peking B Tokyo C Bangkok. Text A B or C 2 21xxx. Correct = 10k cash!" },
  { parentKey: 'uci-vp-14', text: "UR FRIEND USE U BORROW 500MB DATA o! Accept am now, pay b4 next recharge. No lose d free one!" },
  // africa-smishing parents (10)
  { parentKey: 'af-vp-01', text: "GTBank: FINAL WARNING!!! Ur old app go off today today. Due 2 d GTWorld upgrade. Migrate sharp: gtb-upgrade.example.com/app make ur acct open." },
  { parentKey: 'af-vp-02', text: "CBN FINAL NOTICE: BVN re-link deadline na 9am tomorrow o!! Any acct wey no re-link = FROZEN. Do am in 2mins: bvn-relink.example.com/cbn" },
  { parentKey: 'af-vp-03', text: "NIN-SIM FINAL: MTN line without NIN go off 6PM today!! Link am quick: nin-link.example.com/sim b4 u lose ur number." },
  { parentKey: 'af-vp-04', text: "SCHOLARSHIP UPDATE: N200,000 per session don dey shortlist o. 2mins registration: fed-scholar.example.com/apply. No sleep on dis one!" },
  { parentKey: 'af-vp-05', text: "IKEDC UPGRADE: after today, old meter no go take token again!! Upgrade ur meter now: meter-upgrade.example.com/ikeja" },
  { parentKey: 'af-vp-06', text: "Access Bank: KYC fail on ur acct o, dem don freeze am TEMPORARY. Fix am sharp: access-kyc.example.com/fix make d freeze no do permanent." },
  { parentKey: 'af-vp-07', text: "KUDA ALERT: new fone dey inside ur acct 4 Lagos now now. If no be u LOCK AM: kuda-lock.example.com/secure b4 dem clear everything." },
  { parentKey: 'af-vp-08', text: "FRSC LICENCE FLAG: correction dey ur licence. Renew online 3mins: licence-fix.example.com/frsc b4 dem start penalty at checkpoints." },
  { parentKey: 'af-vp-09', text: "NEW MONTH BONUS GO OFF AT MIDNIGHT: recharge 1k, collect 2,500 data o!! Dial *6xx# sharp sharp. Terms apply." },
  { parentKey: 'af-vp-10', text: "UR 1GB DATA DON DEY EXPIRE TOMORO OOO! Activate free now: mydata-bonus.example.com/claim b4 dem wipe am." },
  // SpamAssassin-style parents (6)
  { parentKey: 'sa-vp-01', text: "Dear customer, unknown device enter ur account dis night o! Confirm ur login within 24 hours at trustpay-secure.example.com/verify or we shut am down." },
  { parentKey: 'sa-vp-02', text: "UR CARD DEY FOREIGN SHOP NOW!! No be u? Freeze am sharp at fraud-desk.example.com/idcheck — enter ur card number and PIN make we reverse d charge." },
  { parentKey: 'sa-vp-03', text: "SECURITY UPGRADE: confirm ur PIN + card number today or ur profile go restrict till monday. Security Department." },
  { parentKey: 'sa-vp-04', text: "STOCK RUNNER: PHXC dey 0.35 and insiders don dey buy quietly. Monday morning na d move: 0.35 to 1.20 in 30 days. No sleep on am." },
  { parentKey: 'sa-vp-05', text: "Banks pay u 2%, inflation dey chop 9%! Our commodity fund return 31% last year, audited o. Entry from 500 dollars. Reply 4 prospectus." },
  { parentKey: 'sa-vp-06', text: "Pre-IPO: 2 million-user travel app dey open quiet allocation (min 5,000 dollars, 5x projection). Serious people reply 4 d memo." },
  // Nigerian-Fraud-style parents (5)
  { parentKey: 'nf-vp-01', text: "STRICTLY CONFIDENTIAL!! 15.5 million dollars dey lie idle 4 d apex bank from over-invoiced contract. Civil servant no fit collect am. Help me receive am, take 30 percent. Reply my box: dr-emeka1@example.com" },
  { parentKey: 'nf-vp-02', text: "URGENT FRIEND: 9.2 million dollars deposit, owner die with family 4 plane crash, no will o! Stand as business partner, we share 50/50. Reply fast b4 bank deadline." },
  { parentKey: 'nf-vp-03', text: "PRIVATE BANKING OFFICER writing: late customer account carry 4.8 million dollars with no next of kin! End of quarter dem go sweep am. Be d next of kin, we share 60/40." },
  { parentKey: 'nf-vp-04', text: "8.6 MILLION DOLLARS balance dey hang from d armoured vehicle supply contract. Foreign invoice na d only key. Give account, take 30 percent. Contract papers ready 4 ur lawyer." },
  { parentKey: 'nf-vp-05', text: "CLAIM NOTICE: late foreign engineer group life policy don mature 2.9 million dollars, nobody present am since 8 years! Window closes dis fiscal year — take 40 percent, papers dey ready." },
  // Nazario-style parents (5)
  { parentKey: 'naz-vp-01', text: "Account LIMITATION don land!!! Restore within 24 hours: account-access.example.com/restore — password and card detail dey needed. Sorry 4 d inconvenience." },
  { parentKey: 'naz-vp-02', text: "MAIL SERVER UPGRADE: all staff mailbox must re-validate within 24hrs or EVERYTHING delete including folders. webmail-upgrade.example.com/reset. Mail Systems Team." },
  { parentKey: 'naz-vp-03', text: "Password expire TONIGHT! Renew at portal-cs.example.com/renew with current password or lose all shared drives by morning. Reply HELP." },
  { parentKey: 'naz-vp-04', text: "Hosting account go suspend 4 unpaid 19 dollars o!! Pay and confirm card at bill-center.example.com/pay make ur websites no die." },
  { parentKey: 'naz-vp-05', text: "License lapse in 24 HRS. Upload documents + 25 dollar renewal at e-license.example.com/renew or dem delist ur business." },
];

/** All 80 variant templates, in fixed assembly order (handwritten groups, then datasets). */
export const VARIANTS: readonly VariantSeed[] = HANDWRITTEN_VARIANTS;
