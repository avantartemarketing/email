/**
 * Mock-world fixtures: Shopify order-export CSVs (fed through the REAL
 * importer at seed time) and a fake HubSpot contact directory.
 *
 * The Falling Light export is deliberately messy in the ways real exports
 * are: multi-line-item orders with blank continuation rows, collector names
 * containing commas, a missing email, unrelated line items (tote bags) mixed
 * into the file, an exact duplicate row, and an order with no billing or
 * shipping name. If the screens survive this file, they'll survive the real
 * thing. All people and emails are fictional.
 */

/* One order in the Falling Light export carries a Night Garden line item, on a
   continuation row with every order-level column blank.
   Both halves of that are real Shopify behaviour and both are load-bearing:
   a per-release export contains WHOLE ORDERS, so a collector who bought two
   editions at once brings the other one along — which is what
   `filterItemsForRelease` is for — and a second line item leaves the order's
   own columns empty, which is what the parser's carry-forward is for. */
const HEADER =
  'Name,Email,Financial Status,Paid at,Fulfillment Status,Currency,Subtotal,Created at,Lineitem quantity,Lineitem name,Lineitem price,Lineitem sku,Billing Name,Shipping Name,Shipping Country,Tags';

export const FALLING_LIGHT_CSV = `${HEADER}
#AA10412,jane.whitfield@example.com,paid,2026-03-12 09:14:02 +0000,unfulfilled,GBP,540.00,2026-03-12 09:14:02 +0000,1,Falling Light - Framed,540.00,FL-FR,Jane Whitfield,Jane Whitfield,United Kingdom,
#AA10413,marcus.oduya@example.com,paid,2026-03-12 09:21:44 +0000,unfulfilled,GBP,380.00,2026-03-12 09:21:44 +0000,1,Falling Light - Unframed,380.00,FL-UF,Marcus Oduya,Marcus Oduya,United Kingdom,vip
#AA10415,chidi.okafor@example.org,paid,2026-03-12 09:40:11 +0000,unfulfilled,GBP,380.00,2026-03-12 09:40:11 +0000,1,Falling Light - Unframed,380.00,FL-UF,"Okafor, Chidi","Okafor, Chidi",United Kingdom,repeat-collector
#AA10416,sofia.lindqvist@example.com,paid,2026-03-12 10:02:53 +0000,unfulfilled,GBP,540.00,2026-03-12 10:02:53 +0000,1,Falling Light - Framed,540.00,FL-FR,Sofia Lindqvist,Sofia Lindqvist,United Kingdom,
#AA10418,priya.raman@example.com,paid,2026-03-12 10:15:37 +0000,unfulfilled,GBP,920.00,2026-03-12 10:15:37 +0000,1,Falling Light - Framed,540.00,FL-FR,Priya Raman,Priya Raman,United Kingdom,first-order
,,,,,,,,1,Falling Light - Unframed,380.00,FL-UF,,,,
#AA10419,daan.vermeer@example.com,paid,2026-03-12 10:44:09 +0000,unfulfilled,EUR,620.00,2026-03-12 10:44:09 +0000,1,Falling Light - Framed,540.00,FL-FR,Daan Vermeer,Daan Vermeer,Netherlands,"vip,framed-upgrade"
#AA10421,,paid,2026-03-12 11:03:26 +0000,unfulfilled,GBP,380.00,2026-03-12 11:03:26 +0000,1,Falling Light - Unframed,380.00,FL-UF,Harriet Boyle,Harriet Boyle,United Kingdom,
#AA10422,ines.moreau@example.com,paid,2026-03-12 11:19:48 +0000,unfulfilled,EUR,540.00,2026-03-12 11:19:48 +0000,1,Falling Light - Framed,540.00,FL-FR,Inès Moreau,Inès Moreau,France,repeat-collector
#AA10425,amara.diallo@example.com,paid,2026-03-12 12:00:31 +0000,unfulfilled,GBP,540.00,2026-03-12 12:00:31 +0000,1,Falling Light - Framed,540.00,FL-FR,Amara Diallo,Amara Diallo,United Kingdom,vip
#AA10427,noah.gallagher@example.org,paid,2026-03-12 12:26:55 +0000,unfulfilled,GBP,800.00,2026-03-12 12:26:55 +0000,1,Falling Light - Unframed,380.00,FL-UF,Noah Gallagher,Noah Gallagher,United Kingdom,repeat-collector
,,,,,,,,1,Night Garden - Framed,420.00,NG-FR,,,,
#AA10412,jane.whitfield@example.com,paid,2026-03-12 09:14:02 +0000,unfulfilled,GBP,540.00,2026-03-12 09:14:02 +0000,1,Falling Light - Framed,540.00,FL-FR,Jane Whitfield,Jane Whitfield,United Kingdom,
#AA10428,yuki.tanaka@example.com,paid,2026-03-13 08:12:19 +0000,unfulfilled,GBP,540.00,2026-03-13 08:12:19 +0000,1,Falling Light - Framed,540.00,FL-FR,Yuki Tanaka,Yuki Tanaka,United Kingdom,first-order
#AA10430,lars.petersen@example.net,paid,2026-03-13 09:47:33 +0000,unfulfilled,GBP,380.00,2026-03-13 09:47:33 +0000,1,Falling Light - Unframed,380.00,FL-UF,,,United Kingdom,"vip,framed-upgrade"
#AA10431,greta.hoffmann@example.com,paid,2026-03-13 10:29:56 +0000,unfulfilled,EUR,540.00,2026-03-13 10:29:56 +0000,1,Falling Light - Framed,540.00,FL-FR,Greta Hoffmann,Greta Hoffmann,Germany,
#AA10433,tom.rivera@example.net,paid,2026-03-13 11:52:40 +0000,unfulfilled,USD,540.00,2026-03-13 11:52:40 +0000,1,Falling Light - Framed,540.00,FL-FR,Tom Rivera,Tom Rivera,United States,repeat-collector
#AA10434,alice.ngata@example.com,paid,2026-03-14 07:58:03 +0000,unfulfilled,GBP,380.00,2026-03-14 07:58:03 +0000,1,Falling Light - Unframed,380.00,FL-UF,Alice Ngata,Alice Ngata,United Kingdom,
#AA10436,ben.osei@example.com,paid,2026-03-14 09:36:27 +0000,unfulfilled,GBP,540.00,2026-03-14 09:36:27 +0000,1,Falling Light - Framed,540.00,FL-FR,Ben Osei,Ben Osei,United Kingdom,vip
#AA10437,clara.jimenez@example.org,paid,2026-03-14 10:41:50 +0000,unfulfilled,EUR,380.00,2026-03-14 10:41:50 +0000,1,Falling Light - Unframed,380.00,FL-UF,"Jiménez, Clara","Jiménez, Clara",Italy,repeat-collector
#AA10439,oliver.hart@example.com,paid,2026-03-15 08:22:14 +0000,unfulfilled,GBP,540.00,2026-03-15 08:22:14 +0000,1,Falling Light - Framed,540.00,FL-FR,Oliver Hart,Oliver Hart,United Kingdom,
#AA10440,maja.kowalska@example.com,paid,2026-03-15 09:55:38 +0000,unfulfilled,EUR,540.00,2026-03-15 09:55:38 +0000,1,Falling Light - Framed,540.00,FL-FR,Maja Kowalska,Maja Kowalska,Spain,first-order
#AA10442,ethan.brooks@example.com,paid,2026-03-16 11:08:01 +0000,unfulfilled,USD,380.00,2026-03-16 11:08:01 +0000,1,Falling Light - Unframed,380.00,FL-UF,Ethan Brooks,Ethan Brooks,United States,"vip,framed-upgrade"
#AA10443,nadia.hassan@example.com,paid,2026-03-17 12:33:25 +0000,unfulfilled,GBP,540.00,2026-03-17 12:33:25 +0000,1,Falling Light - Framed,540.00,FL-FR,Nadia Hassan,Nadia Hassan,United Kingdom,
#AA10445,leo.marchetti@example.org,paid,2026-03-18 13:47:49 +0000,unfulfilled,EUR,380.00,2026-03-18 13:47:49 +0000,1,Falling Light - Unframed,380.00,FL-UF,Leo Marchetti,Leo Marchetti,Poland,repeat-collector
#AA10446,freya.dunbar@example.com,paid,2026-03-19 14:59:12 +0000,unfulfilled,GBP,540.00,2026-03-19 14:59:12 +0000,1,Falling Light - Framed,540.00,FL-FR,Freya Dunbar,Freya Dunbar,United Kingdom,
#AA10448,william.acheampong@example.com,paid,2026-03-20 16:04:36 +0000,unfulfilled,GBP,380.00,2026-03-20 16:04:36 +0000,1,Falling Light - Unframed,380.00,FL-UF,William Acheampong,William Acheampong,United Kingdom,vip
#AA10449,rosa.delgado@example.com,paid,2026-03-21 17:18:59 +0000,unfulfilled,EUR,540.00,2026-03-21 17:18:59 +0000,1,Falling Light - Framed,540.00,FL-FR,Rosa Delgado,Rosa Delgado,Netherlands,repeat-collector
#AA10452,alice.hoffmann@example.com,paid,2026-03-25 08:00:00 +0000,unfulfilled,USD,540.00,2026-03-25 08:00:00 +0000,1,Falling Light - Unframed,540.00,SKU,Alice Hoffmann,Alice Hoffmann,United States,
#AA10453,theo.jimenez@example.com,paid,2026-03-25 09:07:00 +0000,unfulfilled,USD,540.00,2026-03-25 09:07:00 +0000,1,Falling Light - Unframed,540.00,SKU,Theo Jimenez,Theo Jimenez,United States,
#AA10454,viktor.hoffmann@example.com,paid,2026-03-25 10:14:00 +0000,unfulfilled,EUR,540.00,2026-03-25 10:14:00 +0000,1,Falling Light - Framed,540.00,SKU,Viktor Hoffmann,Viktor Hoffmann,France,first-order
#AA10456,sven.berger@example.com,paid,2026-03-25 11:21:00 +0000,unfulfilled,GBP,540.00,2026-03-25 11:21:00 +0000,1,Falling Light - Unframed,540.00,SKU,Sven Berger,Sven Berger,United Kingdom,
#AA10457,olivia.vos@example.com,paid,2026-03-25 12:28:00 +0000,unfulfilled,EUR,540.00,2026-03-25 12:28:00 +0000,1,Falling Light - Unframed,540.00,SKU,Olivia Vos,Olivia Vos,Italy,
#AA10459,tariq.duarte@example.com,paid,2026-03-25 13:35:00 +0000,unfulfilled,GBP,540.00,2026-03-25 13:35:00 +0000,1,Falling Light - Framed,540.00,SKU,Tariq Duarte,Tariq Duarte,United Kingdom,
#AA10460,olivia.lindqvist@example.com,paid,2026-03-25 14:42:00 +0000,unfulfilled,EUR,540.00,2026-03-25 14:42:00 +0000,1,Falling Light - Framed,540.00,SKU,Olivia Lindqvist,Olivia Lindqvist,Sweden,
#AA10463,priya.brooks@example.com,paid,2026-03-25 15:49:00 +0000,unfulfilled,USD,540.00,2026-03-25 15:49:00 +0000,1,Falling Light - Framed,540.00,SKU,Priya Brooks,Priya Brooks,Canada,
#AA10466,emil.berger@example.com,paid,2026-03-25 16:56:00 +0000,unfulfilled,GBP,540.00,2026-03-25 16:56:00 +0000,1,Falling Light - Framed,540.00,SKU,Emil Berger,Emil Berger,United Kingdom,newsletter
#AA10467,elif.kowalska@example.com,paid,2026-03-25 08:03:00 +0000,unfulfilled,GBP,540.00,2026-03-25 08:03:00 +0000,1,Falling Light - Framed,540.00,SKU,Elif Kowalska,Elif Kowalska,United Kingdom,
#AA10469,diego.lindqvist@example.com,paid,2026-03-26 09:10:00 +0000,unfulfilled,EUR,540.00,2026-03-26 09:10:00 +0000,1,Falling Light - Unframed,540.00,SKU,Diego Lindqvist,Diego Lindqvist,Spain,
#AA10470,aleksander.brand@example.com,paid,2026-03-26 10:17:00 +0000,unfulfilled,GBP,540.00,2026-03-26 10:17:00 +0000,1,Falling Light - Unframed,540.00,SKU,Aleksander Brand,Aleksander Brand,United Kingdom,gift-order
#AA10472,talia.falk@example.com,paid,2026-03-26 11:24:00 +0000,unfulfilled,EUR,540.00,2026-03-26 11:24:00 +0000,1,Falling Light - Framed,540.00,SKU,Talia Falk,Talia Falk,Germany,
#AA10473,petra.hoffmann@example.com,paid,2026-03-26 12:31:00 +0000,unfulfilled,GBP,540.00,2026-03-26 12:31:00 +0000,1,Falling Light - Framed,540.00,SKU,Petra Hoffmann,Petra Hoffmann,United Kingdom,
#AA10474,leila.sorensen@example.com,paid,2026-03-26 13:38:00 +0000,unfulfilled,EUR,540.00,2026-03-26 13:38:00 +0000,1,Falling Light - Unframed,540.00,SKU,Leila Sorensen,Leila Sorensen,France,
#AA10475,liam.sandberg@example.com,paid,2026-03-26 14:45:00 +0000,unfulfilled,EUR,540.00,2026-03-26 14:45:00 +0000,1,Falling Light - Unframed,540.00,SKU,Liam Sandberg,Liam Sandberg,Germany,
#AA10476,diego.iversen@example.com,paid,2026-03-26 15:52:00 +0000,unfulfilled,EUR,540.00,2026-03-26 15:52:00 +0000,1,Falling Light - Unframed,540.00,SKU,Diego Iversen,Diego Iversen,Sweden,vip
#AA10477,bo.hoffmann@example.com,paid,2026-03-26 16:59:00 +0000,unfulfilled,EUR,540.00,2026-03-26 16:59:00 +0000,1,Falling Light - Framed,540.00,SKU,Bo Hoffmann,Bo Hoffmann,Netherlands,
#AA10478,emil.raman@example.com,paid,2026-03-26 08:06:00 +0000,unfulfilled,GBP,540.00,2026-03-26 08:06:00 +0000,1,Falling Light - Unframed,540.00,SKU,Emil Raman,Emil Raman,United Kingdom,first-order
#AA10479,casper.osei@example.com,paid,2026-03-27 09:13:00 +0000,unfulfilled,USD,540.00,2026-03-27 09:13:00 +0000,1,Falling Light - Framed,540.00,SKU,Casper Osei,Casper Osei,United States,
#AA10480,amara.boyle@example.com,paid,2026-03-27 10:20:00 +0000,unfulfilled,EUR,540.00,2026-03-27 10:20:00 +0000,1,Falling Light - Unframed,540.00,SKU,Amara Boyle,Amara Boyle,Italy,
#AA10481,marta.duarte@example.com,paid,2026-03-27 11:27:00 +0000,unfulfilled,EUR,540.00,2026-03-27 11:27:00 +0000,1,Falling Light - Unframed,540.00,SKU,Marta Duarte,Marta Duarte,Germany,vip
#AA10482,lucia.ferreira@example.com,paid,2026-03-27 12:34:00 +0000,unfulfilled,GBP,540.00,2026-03-27 12:34:00 +0000,1,Falling Light - Framed,540.00,SKU,Lucia Ferreira,Lucia Ferreira,United Kingdom,vip
#AA10485,yuki.mensah@example.com,paid,2026-03-27 13:41:00 +0000,unfulfilled,USD,540.00,2026-03-27 13:41:00 +0000,1,Falling Light - Framed,540.00,SKU,Yuki Mensah,Yuki Mensah,Australia,"vip,repeat-collector"
#AA10488,rafael.jimenez@example.com,paid,2026-03-27 14:48:00 +0000,unfulfilled,EUR,540.00,2026-03-27 14:48:00 +0000,1,Falling Light - Framed,540.00,SKU,Rafael Jimenez,Rafael Jimenez,Germany,
#AA10490,kai.hassan@example.com,paid,2026-03-27 15:55:00 +0000,unfulfilled,USD,540.00,2026-03-27 15:55:00 +0000,1,Falling Light - Framed,540.00,SKU,Kai Hassan,Kai Hassan,Australia,vip
#AA10491,hana.hassan@example.com,paid,2026-03-27 16:02:00 +0000,unfulfilled,GBP,540.00,2026-03-27 16:02:00 +0000,1,Falling Light - Unframed,540.00,SKU,Hana Hassan,Hana Hassan,United Kingdom,
#AA10492,bram.brooks@example.com,paid,2026-03-27 08:09:00 +0000,unfulfilled,EUR,540.00,2026-03-27 08:09:00 +0000,1,Falling Light - Framed,540.00,SKU,Bram Brooks,Bram Brooks,Italy,
#AA10493,petra.blom@example.com,paid,2026-03-28 09:16:00 +0000,unfulfilled,GBP,540.00,2026-03-28 09:16:00 +0000,1,Falling Light - Unframed,540.00,SKU,Petra Blom,Petra Blom,United Kingdom,newsletter
#AA10495,marta.lindgren@example.com,paid,2026-03-28 10:23:00 +0000,unfulfilled,USD,540.00,2026-03-28 10:23:00 +0000,1,Falling Light - Framed,540.00,SKU,Marta Lindgren,Marta Lindgren,United States,gift-order
#AA10497,sofia.oduya@example.com,paid,2026-03-28 11:30:00 +0000,unfulfilled,EUR,540.00,2026-03-28 11:30:00 +0000,1,Falling Light - Framed,540.00,SKU,Sofia Oduya,Sofia Oduya,Netherlands,
#AA10499,marco.andersen@example.com,paid,2026-03-28 12:37:00 +0000,unfulfilled,EUR,540.00,2026-03-28 12:37:00 +0000,1,Falling Light - Unframed,540.00,SKU,Marco Andersen,Marco Andersen,Netherlands,
#AA10502,yuki.lange@example.com,paid,2026-03-28 13:44:00 +0000,unfulfilled,EUR,540.00,2026-03-28 13:44:00 +0000,1,Falling Light - Framed,540.00,SKU,Yuki Lange,Yuki Lange,Germany,
#AA10505,noah.duarte@example.com,paid,2026-03-28 14:51:00 +0000,unfulfilled,EUR,540.00,2026-03-28 14:51:00 +0000,1,Falling Light - Framed,540.00,SKU,Noah Duarte,Noah Duarte,France,
#AA10506,roos.hassan@example.com,paid,2026-03-28 15:58:00 +0000,unfulfilled,EUR,540.00,2026-03-28 15:58:00 +0000,1,Falling Light - Unframed,540.00,SKU,Roos Hassan,Roos Hassan,Germany,
#AA10509,clara.toft@example.com,paid,2026-03-28 16:05:00 +0000,unfulfilled,GBP,540.00,2026-03-28 16:05:00 +0000,1,Falling Light - Unframed,540.00,SKU,Clara Toft,Clara Toft,United Kingdom,newsletter
#AA10510,bruno.acheampong@example.com,paid,2026-03-28 08:12:00 +0000,unfulfilled,EUR,540.00,2026-03-28 08:12:00 +0000,1,Falling Light - Framed,540.00,SKU,Bruno Acheampong,Bruno Acheampong,Netherlands,
#AA10511,elena.acheampong@example.com,paid,2026-04-01 09:19:00 +0000,unfulfilled,EUR,540.00,2026-04-01 09:19:00 +0000,1,Falling Light - Framed,540.00,SKU,Elena Acheampong,Elena Acheampong,Netherlands,
#AA10513,greta.moreau@example.com,paid,2026-04-01 10:26:00 +0000,unfulfilled,EUR,540.00,2026-04-01 10:26:00 +0000,1,Falling Light - Unframed,540.00,SKU,Greta Moreau,Greta Moreau,France,gift-order
#AA10516,elena.bakker@example.com,paid,2026-04-01 11:33:00 +0000,unfulfilled,GBP,540.00,2026-04-01 11:33:00 +0000,1,Falling Light - Framed,540.00,SKU,Elena Bakker,Elena Bakker,United Kingdom,
#AA10517,jan.brand@example.com,paid,2026-04-01 12:40:00 +0000,unfulfilled,EUR,540.00,2026-04-01 12:40:00 +0000,1,Falling Light - Framed,540.00,SKU,Jan Brand,Jan Brand,France,
#AA10520,liam.moreau@example.com,paid,2026-04-01 13:47:00 +0000,unfulfilled,GBP,540.00,2026-04-01 13:47:00 +0000,1,Falling Light - Unframed,540.00,SKU,Liam Moreau,Liam Moreau,United Kingdom,
#AA10521,liam.kaplan@example.com,paid,2026-04-01 14:54:00 +0000,unfulfilled,GBP,540.00,2026-04-01 14:54:00 +0000,1,Falling Light - Unframed,540.00,SKU,Liam Kaplan,Liam Kaplan,United Kingdom,
#AA10522,felix.silva@example.com,paid,2026-04-01 15:01:00 +0000,unfulfilled,GBP,540.00,2026-04-01 15:01:00 +0000,1,Falling Light - Unframed,540.00,SKU,Felix Silva,Felix Silva,United Kingdom,
#AA10524,rune.bakker@example.com,paid,2026-04-01 16:08:00 +0000,unfulfilled,EUR,540.00,2026-04-01 16:08:00 +0000,1,Falling Light - Framed,540.00,SKU,Rune Bakker,Rune Bakker,Italy,
#AA10526,idris.lindgren@example.com,paid,2026-04-01 08:15:00 +0000,unfulfilled,GBP,540.00,2026-04-01 08:15:00 +0000,1,Falling Light - Framed,540.00,SKU,Idris Lindgren,Idris Lindgren,United Kingdom,
#AA10528,rune.weber@example.com,paid,2026-04-02 09:22:00 +0000,unfulfilled,GBP,540.00,2026-04-02 09:22:00 +0000,1,Falling Light - Framed,540.00,SKU,Rune Weber,Rune Weber,United Kingdom,
#AA10531,camille.costa@example.com,paid,2026-04-02 10:29:00 +0000,unfulfilled,EUR,540.00,2026-04-02 10:29:00 +0000,1,Falling Light - Unframed,540.00,SKU,Camille Costa,Camille Costa,France,newsletter
#AA10533,ida.nurmi@example.com,paid,2026-04-02 11:36:00 +0000,unfulfilled,EUR,540.00,2026-04-02 11:36:00 +0000,1,Falling Light - Framed,540.00,SKU,Ida Nurmi,Ida Nurmi,Poland,first-order
#AA10534,elena.gallagher@example.com,paid,2026-04-02 12:43:00 +0000,unfulfilled,EUR,540.00,2026-04-02 12:43:00 +0000,1,Falling Light - Framed,540.00,SKU,Elena Gallagher,Elena Gallagher,Sweden,
#AA10537,tariq.vermeer@example.com,paid,2026-04-02 13:50:00 +0000,unfulfilled,EUR,540.00,2026-04-02 13:50:00 +0000,1,Falling Light - Framed,540.00,SKU,Tariq Vermeer,Tariq Vermeer,France,
#AA10538,otto.brooks@example.com,paid,2026-04-02 14:57:00 +0000,unfulfilled,EUR,540.00,2026-04-02 14:57:00 +0000,1,Falling Light - Unframed,540.00,SKU,Otto Brooks,Otto Brooks,Germany,
#AA10539,sven.rossi@example.com,paid,2026-04-02 15:04:00 +0000,unfulfilled,EUR,540.00,2026-04-02 15:04:00 +0000,1,Falling Light - Framed,540.00,SKU,Sven Rossi,Sven Rossi,Poland,
#AA10541,oscar.raman@example.com,paid,2026-04-02 16:11:00 +0000,unfulfilled,EUR,540.00,2026-04-02 16:11:00 +0000,1,Falling Light - Framed,540.00,SKU,Oscar Raman,Oscar Raman,Italy,repeat-collector
#AA10542,chiara.hoffmann@example.com,paid,2026-04-02 08:18:00 +0000,unfulfilled,USD,540.00,2026-04-02 08:18:00 +0000,1,Falling Light - Unframed,540.00,SKU,Chiara Hoffmann,Chiara Hoffmann,Australia,
#AA10543,anya.sorensen@example.com,paid,2026-04-03 09:25:00 +0000,unfulfilled,EUR,540.00,2026-04-03 09:25:00 +0000,1,Falling Light - Framed,540.00,SKU,Anya Sorensen,Anya Sorensen,Italy,
#AA10546,jonas.kaplan@example.com,paid,2026-04-03 10:32:00 +0000,unfulfilled,EUR,540.00,2026-04-03 10:32:00 +0000,1,Falling Light - Framed,540.00,SKU,Jonas Kaplan,Jonas Kaplan,Germany,
#AA10549,oscar.lindqvist@example.com,paid,2026-04-03 11:39:00 +0000,unfulfilled,GBP,540.00,2026-04-03 11:39:00 +0000,1,Falling Light - Framed,540.00,SKU,Oscar Lindqvist,Oscar Lindqvist,United Kingdom,vip
#AA10552,aya.lindqvist@example.com,paid,2026-04-03 12:46:00 +0000,unfulfilled,GBP,540.00,2026-04-03 12:46:00 +0000,1,Falling Light - Framed,540.00,SKU,Aya Lindqvist,Aya Lindqvist,United Kingdom,
#AA10554,freya.jimenez@example.com,paid,2026-04-03 13:53:00 +0000,unfulfilled,EUR,540.00,2026-04-03 13:53:00 +0000,1,Falling Light - Unframed,540.00,SKU,Freya Jimenez,Freya Jimenez,France,
#AA10555,henrik.nurmi@example.com,paid,2026-04-03 14:00:00 +0000,unfulfilled,EUR,540.00,2026-04-03 14:00:00 +0000,1,Falling Light - Framed,540.00,SKU,Henrik Nurmi,Henrik Nurmi,Spain,gift-order
#AA10557,ida.vos@example.com,paid,2026-04-03 15:07:00 +0000,unfulfilled,EUR,540.00,2026-04-03 15:07:00 +0000,1,Falling Light - Framed,540.00,SKU,Ida Vos,Ida Vos,Netherlands,newsletter
#AA10558,nils.vermeer@example.com,paid,2026-04-03 16:14:00 +0000,unfulfilled,GBP,540.00,2026-04-03 16:14:00 +0000,1,Falling Light - Framed,540.00,SKU,Nils Vermeer,Nils Vermeer,United Kingdom,
#AA10559,diego.osei@example.com,paid,2026-04-03 08:21:00 +0000,unfulfilled,EUR,540.00,2026-04-03 08:21:00 +0000,1,Falling Light - Unframed,540.00,SKU,Diego Osei,Diego Osei,Netherlands,
#AA10562,maya.kaplan@example.com,paid,2026-04-04 09:28:00 +0000,unfulfilled,EUR,540.00,2026-04-04 09:28:00 +0000,1,Falling Light - Framed,540.00,SKU,Maya Kaplan,Maya Kaplan,Italy,
#AA10565,felix.sorensen@example.com,paid,2026-04-04 10:35:00 +0000,unfulfilled,GBP,540.00,2026-04-04 10:35:00 +0000,1,Falling Light - Framed,540.00,SKU,Felix Sorensen,Felix Sorensen,United Kingdom,
#AA10566,tariq.adeyemi@example.com,paid,2026-04-04 11:42:00 +0000,unfulfilled,GBP,540.00,2026-04-04 11:42:00 +0000,1,Falling Light - Framed,540.00,SKU,Tariq Adeyemi,Tariq Adeyemi,United Kingdom,
#AA10567,greta.rossi@example.com,paid,2026-04-04 12:49:00 +0000,unfulfilled,GBP,540.00,2026-04-04 12:49:00 +0000,1,Falling Light - Unframed,540.00,SKU,Greta Rossi,Greta Rossi,United Kingdom,
#AA10568,casper.diallo@example.com,paid,2026-04-04 13:56:00 +0000,unfulfilled,GBP,540.00,2026-04-04 13:56:00 +0000,1,Falling Light - Framed,540.00,SKU,Casper Diallo,Casper Diallo,United Kingdom,
#AA10569,clara.lindgren@example.com,paid,2026-04-04 14:03:00 +0000,unfulfilled,GBP,540.00,2026-04-04 14:03:00 +0000,1,Falling Light - Framed,540.00,SKU,Clara Lindgren,Clara Lindgren,United Kingdom,vip
#AA10571,malik.rasmussen@example.com,paid,2026-04-04 15:10:00 +0000,unfulfilled,EUR,540.00,2026-04-04 15:10:00 +0000,1,Falling Light - Unframed,540.00,SKU,Malik Rasmussen,Malik Rasmussen,Netherlands,
#AA10573,chiara.rasmussen@example.com,paid,2026-04-04 16:17:00 +0000,unfulfilled,EUR,540.00,2026-04-04 16:17:00 +0000,1,Falling Light - Framed,540.00,SKU,Chiara Rasmussen,Chiara Rasmussen,Germany,first-order
#AA10574,nils.ferreira@example.com,paid,2026-04-04 08:24:00 +0000,unfulfilled,USD,540.00,2026-04-04 08:24:00 +0000,1,Falling Light - Framed,540.00,SKU,Nils Ferreira,Nils Ferreira,United States,repeat-collector
#AA10577,priya.hoffmann@example.com,paid,2026-04-05 09:31:00 +0000,unfulfilled,USD,540.00,2026-04-05 09:31:00 +0000,1,Falling Light - Unframed,540.00,SKU,Priya Hoffmann,Priya Hoffmann,United States,newsletter
#AA10578,otto.novak@example.com,paid,2026-04-05 10:38:00 +0000,unfulfilled,GBP,540.00,2026-04-05 10:38:00 +0000,1,Falling Light - Unframed,540.00,SKU,Otto Novak,Otto Novak,United Kingdom,repeat-collector
#AA10581,liam.silva@example.com,paid,2026-04-05 11:45:00 +0000,unfulfilled,GBP,540.00,2026-04-05 11:45:00 +0000,1,Falling Light - Unframed,540.00,SKU,Liam Silva,Liam Silva,United Kingdom,
#AA10582,pierre.lange@example.com,paid,2026-04-05 12:52:00 +0000,unfulfilled,GBP,540.00,2026-04-05 12:52:00 +0000,1,Falling Light - Framed,540.00,SKU,Pierre Lange,Pierre Lange,United Kingdom,
#AA10585,nils.larsen@example.com,paid,2026-04-05 13:59:00 +0000,unfulfilled,EUR,540.00,2026-04-05 13:59:00 +0000,1,Falling Light - Framed,540.00,SKU,Nils Larsen,Nils Larsen,Germany,
#AA10586,rune.haugen@example.com,paid,2026-04-05 14:06:00 +0000,unfulfilled,GBP,540.00,2026-04-05 14:06:00 +0000,1,Falling Light - Unframed,540.00,SKU,Rune Haugen,Rune Haugen,United Kingdom,
#AA10587,signe.vos@example.com,paid,2026-04-05 15:13:00 +0000,unfulfilled,USD,540.00,2026-04-05 15:13:00 +0000,1,Falling Light - Framed,540.00,SKU,Signe Vos,Signe Vos,United States,
#AA10590,roos.dunbar@example.com,paid,2026-04-05 16:20:00 +0000,unfulfilled,USD,540.00,2026-04-05 16:20:00 +0000,1,Falling Light - Unframed,540.00,SKU,Roos Dunbar,Roos Dunbar,United States,
#AA10591,marco.larsen@example.com,paid,2026-04-05 08:27:00 +0000,unfulfilled,GBP,540.00,2026-04-05 08:27:00 +0000,1,Falling Light - Unframed,540.00,SKU,Marco Larsen,Marco Larsen,United Kingdom,
#AA10592,sara.weber@example.com,paid,2026-04-06 09:34:00 +0000,unfulfilled,EUR,540.00,2026-04-06 09:34:00 +0000,1,Falling Light - Framed,540.00,SKU,Sara Weber,Sara Weber,Germany,
#AA10594,petra.okafor@example.com,paid,2026-04-06 10:41:00 +0000,unfulfilled,EUR,540.00,2026-04-06 10:41:00 +0000,1,Falling Light - Framed,540.00,SKU,Petra Okafor,Petra Okafor,France,
#AA10596,alice.weber@example.com,paid,2026-04-06 11:48:00 +0000,unfulfilled,EUR,540.00,2026-04-06 11:48:00 +0000,1,Falling Light - Unframed,540.00,SKU,Alice Weber,Alice Weber,Netherlands,repeat-collector
#AA10597,viktor.adeyemi@example.com,paid,2026-04-06 12:55:00 +0000,unfulfilled,EUR,540.00,2026-04-06 12:55:00 +0000,1,Falling Light - Framed,540.00,SKU,Viktor Adeyemi,Viktor Adeyemi,Germany,
#AA10600,roos.osei@example.com,paid,2026-04-06 13:02:00 +0000,unfulfilled,EUR,540.00,2026-04-06 13:02:00 +0000,1,Falling Light - Framed,540.00,SKU,Roos Osei,Roos Osei,France,first-order
#AA10601,talia.jimenez@example.com,paid,2026-04-06 14:09:00 +0000,unfulfilled,GBP,540.00,2026-04-06 14:09:00 +0000,1,Falling Light - Framed,540.00,SKU,Talia Jimenez,Talia Jimenez,United Kingdom,repeat-collector
#AA10602,hana.lange@example.com,paid,2026-04-06 15:16:00 +0000,unfulfilled,USD,540.00,2026-04-06 15:16:00 +0000,1,Falling Light - Framed,540.00,SKU,Hana Lange,Hana Lange,Canada,
#AA10603,camille.novak@example.com,paid,2026-04-06 16:23:00 +0000,unfulfilled,USD,540.00,2026-04-06 16:23:00 +0000,1,Falling Light - Unframed,540.00,SKU,Camille Novak,Camille Novak,United States,
#AA10605,ines.lange@example.com,paid,2026-04-06 08:30:00 +0000,unfulfilled,EUR,540.00,2026-04-06 08:30:00 +0000,1,Falling Light - Framed,540.00,SKU,Ines Lange,Ines Lange,Netherlands,
#AA10606,yuki.grandi@example.com,paid,2026-04-07 09:37:00 +0000,unfulfilled,GBP,540.00,2026-04-07 09:37:00 +0000,1,Falling Light - Unframed,540.00,SKU,Yuki Grandi,Yuki Grandi,United Kingdom,
#AA10607,elif.delgado@example.com,paid,2026-04-07 10:44:00 +0000,unfulfilled,USD,540.00,2026-04-07 10:44:00 +0000,1,Falling Light - Unframed,540.00,SKU,Elif Delgado,Elif Delgado,United States,
#AA10608,hugo.brooks@example.com,paid,2026-04-07 11:51:00 +0000,unfulfilled,USD,540.00,2026-04-07 11:51:00 +0000,1,Falling Light - Unframed,540.00,SKU,Hugo Brooks,Hugo Brooks,United States,
#AA10611,zara.jimenez@example.com,paid,2026-04-07 12:58:00 +0000,unfulfilled,GBP,540.00,2026-04-07 12:58:00 +0000,1,Falling Light - Unframed,540.00,SKU,Zara Jimenez,Zara Jimenez,United Kingdom,
#AA10612,casper.adeyemi@example.com,paid,2026-04-07 13:05:00 +0000,unfulfilled,USD,540.00,2026-04-07 13:05:00 +0000,1,Falling Light - Framed,540.00,SKU,Casper Adeyemi,Casper Adeyemi,United States,
#AA10613,roos.novak@example.com,paid,2026-04-07 14:12:00 +0000,unfulfilled,USD,540.00,2026-04-07 14:12:00 +0000,1,Falling Light - Unframed,540.00,SKU,Roos Novak,Roos Novak,Australia,"vip,repeat-collector"
#AA10614,tariq.nurmi@example.com,paid,2026-04-07 15:19:00 +0000,unfulfilled,GBP,540.00,2026-04-07 15:19:00 +0000,1,Falling Light - Unframed,540.00,SKU,Tariq Nurmi,Tariq Nurmi,United Kingdom,
#AA10615,nora.iversen@example.com,paid,2026-04-07 16:26:00 +0000,unfulfilled,GBP,540.00,2026-04-07 16:26:00 +0000,1,Falling Light - Unframed,540.00,SKU,Nora Iversen,Nora Iversen,United Kingdom,
#AA10618,bram.andersen@example.com,paid,2026-04-07 08:33:00 +0000,unfulfilled,GBP,540.00,2026-04-07 08:33:00 +0000,1,Falling Light - Unframed,540.00,SKU,Bram Andersen,Bram Andersen,United Kingdom,repeat-collector
#AA10620,noah.gallagher@example.com,paid,2026-04-08 09:40:00 +0000,unfulfilled,USD,540.00,2026-04-08 09:40:00 +0000,1,Falling Light - Framed,540.00,SKU,Noah Gallagher,Noah Gallagher,United States,repeat-collector
#AA10621,ines.rossi@example.com,paid,2026-04-08 10:47:00 +0000,unfulfilled,EUR,540.00,2026-04-08 10:47:00 +0000,1,Falling Light - Unframed,540.00,SKU,Ines Rossi,Ines Rossi,Germany,
#AA10624,mattia.nakamura@example.com,paid,2026-04-08 11:54:00 +0000,unfulfilled,GBP,540.00,2026-04-08 11:54:00 +0000,1,Falling Light - Unframed,540.00,SKU,Mattia Nakamura,Mattia Nakamura,United Kingdom,
#AA10625,iris.fontaine@example.com,paid,2026-04-08 12:01:00 +0000,unfulfilled,USD,540.00,2026-04-08 12:01:00 +0000,1,Falling Light - Framed,540.00,SKU,Iris Fontaine,Iris Fontaine,United States,
#AA10626,mateo.keller@example.com,paid,2026-04-08 13:08:00 +0000,unfulfilled,USD,540.00,2026-04-08 13:08:00 +0000,1,Falling Light - Framed,540.00,SKU,Mateo Keller,Mateo Keller,Australia,
#AA10628,joris.mensah@example.com,paid,2026-04-08 14:15:00 +0000,unfulfilled,GBP,540.00,2026-04-08 14:15:00 +0000,1,Falling Light - Unframed,540.00,SKU,Joris Mensah,Joris Mensah,United Kingdom,
#AA10631,rosa.okafor@example.com,paid,2026-04-08 15:22:00 +0000,unfulfilled,EUR,540.00,2026-04-08 15:22:00 +0000,1,Falling Light - Unframed,540.00,SKU,Rosa Okafor,Rosa Okafor,Germany,
#AA10632,sara.whitfield@example.com,paid,2026-04-08 16:29:00 +0000,unfulfilled,EUR,540.00,2026-04-08 16:29:00 +0000,1,Falling Light - Framed,540.00,SKU,Sara Whitfield,Sara Whitfield,Sweden,
#AA10633,talia.halvorsen@example.com,paid,2026-04-08 08:36:00 +0000,unfulfilled,GBP,540.00,2026-04-08 08:36:00 +0000,1,Falling Light - Framed,540.00,SKU,Talia Halvorsen,Talia Halvorsen,United Kingdom,
#AA10635,nils.bakker@example.com,paid,2026-04-08 09:43:00 +0000,unfulfilled,GBP,540.00,2026-04-08 09:43:00 +0000,1,Falling Light - Framed,540.00,SKU,Nils Bakker,Nils Bakker,United Kingdom,
#AA10638,yuki.ferreira@example.com,paid,2026-04-09 10:50:00 +0000,unfulfilled,EUR,540.00,2026-04-09 10:50:00 +0000,1,Falling Light - Framed,540.00,SKU,Yuki Ferreira,Yuki Ferreira,France,
#AA10639,ethan.sorensen@example.com,paid,2026-04-09 11:57:00 +0000,unfulfilled,GBP,540.00,2026-04-09 11:57:00 +0000,1,Falling Light - Framed,540.00,SKU,Ethan Sorensen,Ethan Sorensen,United Kingdom,
#AA10641,amelia.brooks@example.com,paid,2026-04-09 12:04:00 +0000,unfulfilled,EUR,540.00,2026-04-09 12:04:00 +0000,1,Falling Light - Framed,540.00,SKU,Amelia Brooks,Amelia Brooks,Sweden,repeat-collector
#AA10642,anya.lindgren@example.com,paid,2026-04-09 13:11:00 +0000,unfulfilled,EUR,540.00,2026-04-09 13:11:00 +0000,1,Falling Light - Framed,540.00,SKU,Anya Lindgren,Anya Lindgren,Netherlands,newsletter
#AA10643,isla.mensah@example.com,paid,2026-04-09 14:18:00 +0000,unfulfilled,EUR,540.00,2026-04-09 14:18:00 +0000,1,Falling Light - Framed,540.00,SKU,Isla Mensah,Isla Mensah,Germany,
#AA10645,noah.hoffmann@example.com,paid,2026-04-09 15:25:00 +0000,unfulfilled,EUR,540.00,2026-04-09 15:25:00 +0000,1,Falling Light - Framed,540.00,SKU,Noah Hoffmann,Noah Hoffmann,Italy,
#AA10646,talia.mensah@example.com,paid,2026-04-09 16:32:00 +0000,unfulfilled,GBP,540.00,2026-04-09 16:32:00 +0000,1,Falling Light - Unframed,540.00,SKU,Talia Mensah,Talia Mensah,United Kingdom,
#AA10649,nora.petersen@example.com,paid,2026-04-09 08:39:00 +0000,unfulfilled,EUR,540.00,2026-04-09 08:39:00 +0000,1,Falling Light - Unframed,540.00,SKU,Nora Petersen,Nora Petersen,Denmark,vip
#AA10650,maya.berger@example.com,paid,2026-04-09 09:46:00 +0000,unfulfilled,EUR,540.00,2026-04-09 09:46:00 +0000,1,Falling Light - Unframed,540.00,SKU,Maya Berger,Maya Berger,Spain,gift-order
#AA10652,maya.rasmussen@example.com,paid,2026-04-10 10:53:00 +0000,unfulfilled,USD,540.00,2026-04-10 10:53:00 +0000,1,Falling Light - Unframed,540.00,SKU,Maya Rasmussen,Maya Rasmussen,United States,
#AA10655,mattia.fontaine@example.com,paid,2026-04-10 11:00:00 +0000,unfulfilled,GBP,540.00,2026-04-10 11:00:00 +0000,1,Falling Light - Unframed,540.00,SKU,Mattia Fontaine,Mattia Fontaine,United Kingdom,gift-order
#AA10656,anya.raman@example.com,paid,2026-04-10 12:07:00 +0000,unfulfilled,EUR,540.00,2026-04-10 12:07:00 +0000,1,Falling Light - Framed,540.00,SKU,Anya Raman,Anya Raman,France,
#AA10658,anders.duarte@example.com,paid,2026-04-10 13:14:00 +0000,unfulfilled,GBP,540.00,2026-04-10 13:14:00 +0000,1,Falling Light - Unframed,540.00,SKU,Anders Duarte,Anders Duarte,United Kingdom,
#AA10660,lukas.hart@example.com,paid,2026-04-10 14:21:00 +0000,unfulfilled,GBP,540.00,2026-04-10 14:21:00 +0000,1,Falling Light - Framed,540.00,SKU,Lukas Hart,Lukas Hart,United Kingdom,
#AA10663,sven.toft@example.com,paid,2026-04-10 15:28:00 +0000,unfulfilled,USD,540.00,2026-04-10 15:28:00 +0000,1,Falling Light - Framed,540.00,SKU,Sven Toft,Sven Toft,United States,
#AA10665,lucia.dubois@example.com,paid,2026-04-10 16:35:00 +0000,unfulfilled,USD,540.00,2026-04-10 16:35:00 +0000,1,Falling Light - Framed,540.00,SKU,Lucia Dubois,Lucia Dubois,Japan,
#AA10666,leila.kaplan@example.com,paid,2026-04-10 08:42:00 +0000,unfulfilled,EUR,540.00,2026-04-10 08:42:00 +0000,1,Falling Light - Unframed,540.00,SKU,Leila Kaplan,Leila Kaplan,Germany,gift-order
#AA10668,elif.rivera@example.com,paid,2026-04-10 09:49:00 +0000,unfulfilled,USD,540.00,2026-04-10 09:49:00 +0000,1,Falling Light - Unframed,540.00,SKU,Elif Rivera,Elif Rivera,United States,
#AA10670,ines.osei@example.com,paid,2026-04-11 10:56:00 +0000,unfulfilled,USD,540.00,2026-04-11 10:56:00 +0000,1,Falling Light - Framed,540.00,SKU,Ines Osei,Ines Osei,United States,
#AA10671,solveig.sandberg@example.com,paid,2026-04-11 11:03:00 +0000,unfulfilled,EUR,540.00,2026-04-11 11:03:00 +0000,1,Falling Light - Framed,540.00,SKU,Solveig Sandberg,Solveig Sandberg,Italy,first-order
#AA10673,chiara.gallagher@example.com,paid,2026-04-11 12:10:00 +0000,unfulfilled,GBP,540.00,2026-04-11 12:10:00 +0000,1,Falling Light - Unframed,540.00,SKU,Chiara Gallagher,Chiara Gallagher,United Kingdom,
#AA10676,felix.sandberg@example.com,paid,2026-04-11 13:17:00 +0000,unfulfilled,EUR,540.00,2026-04-11 13:17:00 +0000,1,Falling Light - Framed,540.00,SKU,Felix Sandberg,Felix Sandberg,Sweden,newsletter
#AA10677,petra.sorensen@example.com,paid,2026-04-11 14:24:00 +0000,unfulfilled,USD,540.00,2026-04-11 14:24:00 +0000,1,Falling Light - Framed,540.00,SKU,Petra Sorensen,Petra Sorensen,United States,
#AA10679,elif.diallo@example.com,paid,2026-04-11 15:31:00 +0000,unfulfilled,GBP,540.00,2026-04-11 15:31:00 +0000,1,Falling Light - Unframed,540.00,SKU,Elif Diallo,Elif Diallo,United Kingdom,"vip,repeat-collector"
#AA10680,roos.mensah@example.com,paid,2026-04-11 16:38:00 +0000,unfulfilled,EUR,540.00,2026-04-11 16:38:00 +0000,1,Falling Light - Unframed,540.00,SKU,Roos Mensah,Roos Mensah,France,
#AA10681,signe.nakamura@example.com,paid,2026-04-11 08:45:00 +0000,unfulfilled,USD,540.00,2026-04-11 08:45:00 +0000,1,Falling Light - Framed,540.00,SKU,Signe Nakamura,Signe Nakamura,United States,
#AA10682,petra.mensah@example.com,paid,2026-04-11 09:52:00 +0000,unfulfilled,EUR,540.00,2026-04-11 09:52:00 +0000,1,Falling Light - Framed,540.00,SKU,Petra Mensah,Petra Mensah,France,
#AA10683,sara.dunbar@example.com,paid,2026-04-12 10:59:00 +0000,unfulfilled,EUR,540.00,2026-04-12 10:59:00 +0000,1,Falling Light - Framed,540.00,SKU,Sara Dunbar,Sara Dunbar,Germany,
#AA10686,nadia.delgado@example.com,paid,2026-04-12 11:06:00 +0000,unfulfilled,USD,540.00,2026-04-12 11:06:00 +0000,1,Falling Light - Unframed,540.00,SKU,Nadia Delgado,Nadia Delgado,Japan,first-order
#AA10688,anouk.costa@example.com,paid,2026-04-12 12:13:00 +0000,unfulfilled,GBP,540.00,2026-04-12 12:13:00 +0000,1,Falling Light - Unframed,540.00,SKU,Anouk Costa,Anouk Costa,United Kingdom,
#AA10690,mia.nurmi@example.com,paid,2026-04-12 13:20:00 +0000,unfulfilled,USD,540.00,2026-04-12 13:20:00 +0000,1,Falling Light - Unframed,540.00,SKU,Mia Nurmi,Mia Nurmi,Japan,
#AA10693,alice.rasmussen@example.com,paid,2026-04-12 14:27:00 +0000,unfulfilled,USD,540.00,2026-04-12 14:27:00 +0000,1,Falling Light - Framed,540.00,SKU,Alice Rasmussen,Alice Rasmussen,Australia,
#AA10696,jan.dunbar@example.com,paid,2026-04-12 15:34:00 +0000,unfulfilled,USD,540.00,2026-04-12 15:34:00 +0000,1,Falling Light - Unframed,540.00,SKU,Jan Dunbar,Jan Dunbar,Japan,
#AA10699,joris.nurmi@example.com,paid,2026-04-12 16:41:00 +0000,unfulfilled,GBP,540.00,2026-04-12 16:41:00 +0000,1,Falling Light - Unframed,540.00,SKU,Joris Nurmi,Joris Nurmi,United Kingdom,"vip,repeat-collector"
#AA10700,priya.vos@example.com,paid,2026-04-12 08:48:00 +0000,unfulfilled,EUR,540.00,2026-04-12 08:48:00 +0000,1,Falling Light - Framed,540.00,SKU,Priya Vos,Priya Vos,France,
#AA10703,ava.bakker@example.com,paid,2026-04-12 09:55:00 +0000,unfulfilled,GBP,540.00,2026-04-12 09:55:00 +0000,1,Falling Light - Unframed,540.00,SKU,Ava Bakker,Ava Bakker,United Kingdom,
#AA10705,camille.nakamura@example.com,paid,2026-04-13 10:02:00 +0000,unfulfilled,USD,540.00,2026-04-13 10:02:00 +0000,1,Falling Light - Unframed,540.00,SKU,Camille Nakamura,Camille Nakamura,United States,
#AA10706,freya.halvorsen@example.com,paid,2026-04-13 11:09:00 +0000,unfulfilled,EUR,540.00,2026-04-13 11:09:00 +0000,1,Falling Light - Unframed,540.00,SKU,Freya Halvorsen,Freya Halvorsen,Sweden,first-order
#AA10707,rafael.novak@example.com,paid,2026-04-13 12:16:00 +0000,unfulfilled,EUR,540.00,2026-04-13 12:16:00 +0000,1,Falling Light - Unframed,540.00,SKU,Rafael Novak,Rafael Novak,Netherlands,
#AA10710,alice.delgado@example.com,paid,2026-04-13 13:23:00 +0000,unfulfilled,GBP,540.00,2026-04-13 13:23:00 +0000,1,Falling Light - Unframed,540.00,SKU,Alice Delgado,Alice Delgado,United Kingdom,
#AA10711,pierre.silva@example.com,paid,2026-04-13 14:30:00 +0000,unfulfilled,EUR,540.00,2026-04-13 14:30:00 +0000,1,Falling Light - Unframed,540.00,SKU,Pierre Silva,Pierre Silva,Poland,
#AA10712,casper.bakker@example.com,paid,2026-04-13 15:37:00 +0000,unfulfilled,USD,540.00,2026-04-13 15:37:00 +0000,1,Falling Light - Framed,540.00,SKU,Casper Bakker,Casper Bakker,United States,
#AA10714,nora.rasmussen@example.com,paid,2026-04-13 16:44:00 +0000,unfulfilled,USD,540.00,2026-04-13 16:44:00 +0000,1,Falling Light - Unframed,540.00,SKU,Nora Rasmussen,Nora Rasmussen,United States,repeat-collector
#AA10716,olivia.grandi@example.com,paid,2026-04-13 08:51:00 +0000,unfulfilled,EUR,540.00,2026-04-13 08:51:00 +0000,1,Falling Light - Framed,540.00,SKU,Olivia Grandi,Olivia Grandi,Sweden,gift-order
#AA10717,amara.marchetti@example.com,paid,2026-04-13 09:58:00 +0000,unfulfilled,USD,540.00,2026-04-13 09:58:00 +0000,1,Falling Light - Unframed,540.00,SKU,Amara Marchetti,Amara Marchetti,Australia,"vip,repeat-collector"
#AA10718,marta.lindqvist@example.com,paid,2026-04-14 10:05:00 +0000,unfulfilled,EUR,540.00,2026-04-14 10:05:00 +0000,1,Falling Light - Framed,540.00,SKU,Marta Lindqvist,Marta Lindqvist,France,vip
#AA10719,jonas.costa@example.com,paid,2026-04-14 11:12:00 +0000,unfulfilled,EUR,540.00,2026-04-14 11:12:00 +0000,1,Falling Light - Framed,540.00,SKU,Jonas Costa,Jonas Costa,Germany,gift-order
#AA10720,tariq.acheampong@example.com,paid,2026-04-14 12:19:00 +0000,unfulfilled,EUR,540.00,2026-04-14 12:19:00 +0000,1,Falling Light - Framed,540.00,SKU,Tariq Acheampong,Tariq Acheampong,Germany,
#AA10722,elif.sandberg@example.com,paid,2026-04-14 13:26:00 +0000,unfulfilled,GBP,540.00,2026-04-14 13:26:00 +0000,1,Falling Light - Unframed,540.00,SKU,Elif Sandberg,Elif Sandberg,United Kingdom,
#AA10723,rosa.fontaine@example.com,paid,2026-04-14 14:33:00 +0000,unfulfilled,EUR,540.00,2026-04-14 14:33:00 +0000,1,Falling Light - Unframed,540.00,SKU,Rosa Fontaine,Rosa Fontaine,Netherlands,
#AA10725,dmitri.boyle@example.com,paid,2026-04-14 15:40:00 +0000,unfulfilled,EUR,540.00,2026-04-14 15:40:00 +0000,1,Falling Light - Unframed,540.00,SKU,Dmitri Boyle,Dmitri Boyle,Italy,newsletter
#AA10726,nadia.molnar@example.com,paid,2026-04-14 16:47:00 +0000,unfulfilled,EUR,540.00,2026-04-14 16:47:00 +0000,1,Falling Light - Unframed,540.00,SKU,Nadia Molnar,Nadia Molnar,France,
#AA10727,leila.rasmussen@example.com,paid,2026-04-14 08:54:00 +0000,unfulfilled,GBP,540.00,2026-04-14 08:54:00 +0000,1,Falling Light - Unframed,540.00,SKU,Leila Rasmussen,Leila Rasmussen,United Kingdom,gift-order
#AA10729,marco.mensah@example.com,paid,2026-04-14 09:01:00 +0000,unfulfilled,GBP,540.00,2026-04-14 09:01:00 +0000,1,Falling Light - Unframed,540.00,SKU,Marco Mensah,Marco Mensah,United Kingdom,
#AA10732,pierre.kowalska@example.com,paid,2026-04-15 10:08:00 +0000,unfulfilled,GBP,540.00,2026-04-15 10:08:00 +0000,1,Falling Light - Framed,540.00,SKU,Pierre Kowalska,Pierre Kowalska,United Kingdom,
#AA10733,sanne.toft@example.com,paid,2026-04-15 11:15:00 +0000,unfulfilled,GBP,540.00,2026-04-15 11:15:00 +0000,1,Falling Light - Framed,540.00,SKU,Sanne Toft,Sanne Toft,United Kingdom,repeat-collector
#AA10734,mattia.aalto@example.com,paid,2026-04-15 12:22:00 +0000,unfulfilled,EUR,540.00,2026-04-15 12:22:00 +0000,1,Falling Light - Framed,540.00,SKU,Mattia Aalto,Mattia Aalto,Netherlands,newsletter
#AA10736,pierre.aalto@example.com,paid,2026-04-15 13:29:00 +0000,unfulfilled,GBP,540.00,2026-04-15 13:29:00 +0000,1,Falling Light - Framed,540.00,SKU,Pierre Aalto,Pierre Aalto,United Kingdom,newsletter
#AA10737,bram.vermeer@example.com,paid,2026-04-15 14:36:00 +0000,unfulfilled,GBP,540.00,2026-04-15 14:36:00 +0000,1,Falling Light - Unframed,540.00,SKU,Bram Vermeer,Bram Vermeer,United Kingdom,
#AA10740,amara.brooks@example.com,paid,2026-04-15 15:43:00 +0000,unfulfilled,EUR,540.00,2026-04-15 15:43:00 +0000,1,Falling Light - Unframed,540.00,SKU,Amara Brooks,Amara Brooks,Denmark,
#AA10743,ida.lindgren@example.com,paid,2026-04-15 16:50:00 +0000,unfulfilled,USD,540.00,2026-04-15 16:50:00 +0000,1,Falling Light - Unframed,540.00,SKU,Ida Lindgren,Ida Lindgren,United States,
#AA10745,petra.acheampong@example.com,paid,2026-04-15 08:57:00 +0000,unfulfilled,USD,540.00,2026-04-15 08:57:00 +0000,1,Falling Light - Unframed,540.00,SKU,Petra Acheampong,Petra Acheampong,United States,
#AA10746,stefan.whitfield@example.com,paid,2026-04-15 09:04:00 +0000,unfulfilled,EUR,540.00,2026-04-15 09:04:00 +0000,1,Falling Light - Framed,540.00,SKU,Stefan Whitfield,Stefan Whitfield,France,
#AA10747,solveig.tanaka@example.com,paid,2026-04-16 10:11:00 +0000,unfulfilled,EUR,540.00,2026-04-16 10:11:00 +0000,1,Falling Light - Unframed,540.00,SKU,Solveig Tanaka,Solveig Tanaka,Netherlands,newsletter
#AA10748,diego.grandi@example.com,paid,2026-04-16 11:18:00 +0000,unfulfilled,EUR,540.00,2026-04-16 11:18:00 +0000,1,Falling Light - Framed,540.00,SKU,Diego Grandi,Diego Grandi,Spain,
#AA10749,olivia.larsen@example.com,paid,2026-04-16 12:25:00 +0000,unfulfilled,USD,540.00,2026-04-16 12:25:00 +0000,1,Falling Light - Framed,540.00,SKU,Olivia Larsen,Olivia Larsen,United States,first-order
#AA10750,casper.mensah@example.com,paid,2026-04-16 13:32:00 +0000,unfulfilled,GBP,540.00,2026-04-16 13:32:00 +0000,1,Falling Light - Unframed,540.00,SKU,Casper Mensah,Casper Mensah,United Kingdom,"vip,repeat-collector"
#AA10751,rosa.jimenez@example.com,paid,2026-04-16 14:39:00 +0000,unfulfilled,USD,540.00,2026-04-16 14:39:00 +0000,1,Falling Light - Framed,540.00,SKU,Rosa Jimenez,Rosa Jimenez,Australia,first-order
#AA10753,sara.vermeer@example.com,paid,2026-04-16 15:46:00 +0000,unfulfilled,EUR,540.00,2026-04-16 15:46:00 +0000,1,Falling Light - Unframed,540.00,SKU,Sara Vermeer,Sara Vermeer,Sweden,repeat-collector
#AA10754,noah.mensah@example.com,paid,2026-04-16 16:53:00 +0000,unfulfilled,USD,540.00,2026-04-16 16:53:00 +0000,1,Falling Light - Unframed,540.00,SKU,Noah Mensah,Noah Mensah,Japan,
#AA10757,otto.hassan@example.com,paid,2026-04-16 08:00:00 +0000,unfulfilled,USD,540.00,2026-04-16 08:00:00 +0000,1,Falling Light - Framed,540.00,SKU,Otto Hassan,Otto Hassan,United States,
#AA10759,jonas.dubois@example.com,paid,2026-04-16 09:07:00 +0000,unfulfilled,EUR,540.00,2026-04-16 09:07:00 +0000,1,Falling Light - Unframed,540.00,SKU,Jonas Dubois,Jonas Dubois,Italy,
#AA10762,bram.nurmi@example.com,paid,2026-04-17 10:14:00 +0000,unfulfilled,USD,540.00,2026-04-17 10:14:00 +0000,1,Falling Light - Unframed,540.00,SKU,Bram Nurmi,Bram Nurmi,United States,
#AA10765,kai.bianchi@example.com,paid,2026-04-17 11:21:00 +0000,unfulfilled,USD,540.00,2026-04-17 11:21:00 +0000,1,Falling Light - Framed,540.00,SKU,Kai Bianchi,Kai Bianchi,United States,
#AA10766,diego.hassan@example.com,paid,2026-04-17 12:28:00 +0000,unfulfilled,GBP,540.00,2026-04-17 12:28:00 +0000,1,Falling Light - Framed,540.00,SKU,Diego Hassan,Diego Hassan,United Kingdom,
#AA10767,anders.marchetti@example.com,paid,2026-04-17 13:35:00 +0000,unfulfilled,EUR,540.00,2026-04-17 13:35:00 +0000,1,Falling Light - Framed,540.00,SKU,Anders Marchetti,Anders Marchetti,Netherlands,
#AA10768,arthur.berger@example.com,paid,2026-04-17 14:42:00 +0000,unfulfilled,EUR,540.00,2026-04-17 14:42:00 +0000,1,Falling Light - Framed,540.00,SKU,Arthur Berger,Arthur Berger,Sweden,gift-order
#AA10771,ethan.blom@example.com,paid,2026-04-17 15:49:00 +0000,unfulfilled,EUR,540.00,2026-04-17 15:49:00 +0000,1,Falling Light - Framed,540.00,SKU,Ethan Blom,Ethan Blom,Italy,
#AA10774,mateo.nurmi@example.com,paid,2026-04-17 16:56:00 +0000,unfulfilled,USD,540.00,2026-04-17 16:56:00 +0000,1,Falling Light - Unframed,540.00,SKU,Mateo Nurmi,Mateo Nurmi,Japan,
#AA10777,jan.falk@example.com,paid,2026-04-17 08:03:00 +0000,unfulfilled,GBP,540.00,2026-04-17 08:03:00 +0000,1,Falling Light - Unframed,540.00,SKU,Jan Falk,Jan Falk,United Kingdom,
#AA10779,bruno.costa@example.com,paid,2026-04-17 09:10:00 +0000,unfulfilled,EUR,540.00,2026-04-17 09:10:00 +0000,1,Falling Light - Framed,540.00,SKU,Bruno Costa,Bruno Costa,Spain,
#AA10782,freya.sandberg@example.com,paid,2026-04-18 10:17:00 +0000,unfulfilled,GBP,540.00,2026-04-18 10:17:00 +0000,1,Falling Light - Framed,540.00,SKU,Freya Sandberg,Freya Sandberg,United Kingdom,
#AA10783,stefan.moreau@example.com,paid,2026-04-18 11:24:00 +0000,unfulfilled,EUR,540.00,2026-04-18 11:24:00 +0000,1,Falling Light - Unframed,540.00,SKU,Stefan Moreau,Stefan Moreau,Netherlands,
#AA10784,amelia.acheampong@example.com,paid,2026-04-18 12:31:00 +0000,unfulfilled,USD,540.00,2026-04-18 12:31:00 +0000,1,Falling Light - Framed,540.00,SKU,Amelia Acheampong,Amelia Acheampong,Japan,
#AA10785,pierre.berger@example.com,paid,2026-04-18 13:38:00 +0000,unfulfilled,GBP,540.00,2026-04-18 13:38:00 +0000,1,Falling Light - Framed,540.00,SKU,Pierre Berger,Pierre Berger,United Kingdom,vip
#AA10787,aleksander.duarte@example.com,paid,2026-04-18 14:45:00 +0000,unfulfilled,GBP,540.00,2026-04-18 14:45:00 +0000,1,Falling Light - Framed,540.00,SKU,Aleksander Duarte,Aleksander Duarte,United Kingdom,
#AA10789,anya.lindqvist@example.com,paid,2026-04-18 15:52:00 +0000,unfulfilled,USD,540.00,2026-04-18 15:52:00 +0000,1,Falling Light - Framed,540.00,SKU,Anya Lindqvist,Anya Lindqvist,United States,gift-order
#AA10791,idris.kaplan@example.com,paid,2026-04-18 16:59:00 +0000,unfulfilled,USD,540.00,2026-04-18 16:59:00 +0000,1,Falling Light - Unframed,540.00,SKU,Idris Kaplan,Idris Kaplan,United States,
#AA10794,sanne.haugen@example.com,paid,2026-04-18 08:06:00 +0000,unfulfilled,GBP,540.00,2026-04-18 08:06:00 +0000,1,Falling Light - Unframed,540.00,SKU,Sanne Haugen,Sanne Haugen,United Kingdom,
#AA10796,olivia.petersen@example.com,paid,2026-04-18 09:13:00 +0000,unfulfilled,USD,540.00,2026-04-18 09:13:00 +0000,1,Falling Light - Unframed,540.00,SKU,Olivia Petersen,Olivia Petersen,Japan,first-order
#AA10797,isla.petersen@example.com,paid,2026-04-19 10:20:00 +0000,unfulfilled,EUR,540.00,2026-04-19 10:20:00 +0000,1,Falling Light - Framed,540.00,SKU,Isla Petersen,Isla Petersen,Italy,
#AA10798,priya.petersen@example.com,paid,2026-04-19 11:27:00 +0000,unfulfilled,GBP,540.00,2026-04-19 11:27:00 +0000,1,Falling Light - Framed,540.00,SKU,Priya Petersen,Priya Petersen,United Kingdom,
#AA10800,sven.vermeer@example.com,paid,2026-04-19 12:34:00 +0000,unfulfilled,USD,540.00,2026-04-19 12:34:00 +0000,1,Falling Light - Unframed,540.00,SKU,Sven Vermeer,Sven Vermeer,United States,first-order
#AA10803,joris.hart@example.com,paid,2026-04-19 13:41:00 +0000,unfulfilled,USD,540.00,2026-04-19 13:41:00 +0000,1,Falling Light - Framed,540.00,SKU,Joris Hart,Joris Hart,United States,
#AA10805,sara.lindqvist@example.com,paid,2026-04-19 14:48:00 +0000,unfulfilled,GBP,540.00,2026-04-19 14:48:00 +0000,1,Falling Light - Unframed,540.00,SKU,Sara Lindqvist,Sara Lindqvist,United Kingdom,vip
#AA10806,priya.fontaine@example.com,paid,2026-04-19 15:55:00 +0000,unfulfilled,USD,540.00,2026-04-19 15:55:00 +0000,1,Falling Light - Framed,540.00,SKU,Priya Fontaine,Priya Fontaine,Japan,repeat-collector
#AA10807,bruno.sorensen@example.com,paid,2026-04-19 16:02:00 +0000,unfulfilled,GBP,540.00,2026-04-19 16:02:00 +0000,1,Falling Light - Framed,540.00,SKU,Bruno Sorensen,Bruno Sorensen,United Kingdom,vip
#AA10808,idris.ferreira@example.com,paid,2026-04-19 08:09:00 +0000,unfulfilled,USD,540.00,2026-04-19 08:09:00 +0000,1,Falling Light - Framed,540.00,SKU,Idris Ferreira,Idris Ferreira,Australia,
#AA10811,noah.brand@example.com,paid,2026-04-19 09:16:00 +0000,unfulfilled,GBP,540.00,2026-04-19 09:16:00 +0000,1,Falling Light - Framed,540.00,SKU,Noah Brand,Noah Brand,United Kingdom,
#AA10812,ines.okafor@example.com,paid,2026-04-19 10:23:00 +0000,unfulfilled,USD,540.00,2026-04-19 10:23:00 +0000,1,Falling Light - Framed,540.00,SKU,Ines Okafor,Ines Okafor,United States,
#AA10813,rune.okafor@example.com,paid,2026-04-20 11:30:00 +0000,unfulfilled,USD,540.00,2026-04-20 11:30:00 +0000,1,Falling Light - Framed,540.00,SKU,Rune Okafor,Rune Okafor,United States,
#AA10815,emil.mensah@example.com,paid,2026-04-20 12:37:00 +0000,unfulfilled,EUR,540.00,2026-04-20 12:37:00 +0000,1,Falling Light - Unframed,540.00,SKU,Emil Mensah,Emil Mensah,Denmark,
#AA10816,lena.novak@example.com,paid,2026-04-20 13:44:00 +0000,unfulfilled,EUR,540.00,2026-04-20 13:44:00 +0000,1,Falling Light - Unframed,540.00,SKU,Lena Novak,Lena Novak,France,
#AA10817,lukas.rivera@example.com,paid,2026-04-20 14:51:00 +0000,unfulfilled,EUR,540.00,2026-04-20 14:51:00 +0000,1,Falling Light - Unframed,540.00,SKU,Lukas Rivera,Lukas Rivera,Poland,
#AA10820,bo.toft@example.com,paid,2026-04-20 15:58:00 +0000,unfulfilled,EUR,540.00,2026-04-20 15:58:00 +0000,1,Falling Light - Unframed,540.00,SKU,Bo Toft,Bo Toft,Germany,
#AA10821,hugo.halvorsen@example.com,paid,2026-04-20 16:05:00 +0000,unfulfilled,GBP,540.00,2026-04-20 16:05:00 +0000,1,Falling Light - Framed,540.00,SKU,Hugo Halvorsen,Hugo Halvorsen,United Kingdom,
#AA10824,sanne.ferreira@example.com,paid,2026-04-20 08:12:00 +0000,unfulfilled,USD,540.00,2026-04-20 08:12:00 +0000,1,Falling Light - Unframed,540.00,SKU,Sanne Ferreira,Sanne Ferreira,United States,
#AA10825,tariq.fontaine@example.com,paid,2026-04-20 09:19:00 +0000,unfulfilled,EUR,540.00,2026-04-20 09:19:00 +0000,1,Falling Light - Framed,540.00,SKU,Tariq Fontaine,Tariq Fontaine,France,repeat-collector
#AA10828,hugo.duarte@example.com,paid,2026-04-20 10:26:00 +0000,unfulfilled,GBP,540.00,2026-04-20 10:26:00 +0000,1,Falling Light - Unframed,540.00,SKU,Hugo Duarte,Hugo Duarte,United Kingdom,
#AA10831,tariq.tanaka@example.com,paid,2026-04-21 11:33:00 +0000,unfulfilled,GBP,540.00,2026-04-21 11:33:00 +0000,1,Falling Light - Unframed,540.00,SKU,Tariq Tanaka,Tariq Tanaka,United Kingdom,
#AA10833,talia.dubois@example.com,paid,2026-04-21 12:40:00 +0000,unfulfilled,GBP,540.00,2026-04-21 12:40:00 +0000,1,Falling Light - Unframed,540.00,SKU,Talia Dubois,Talia Dubois,United Kingdom,
#AA10836,mia.keller@example.com,paid,2026-04-21 13:47:00 +0000,unfulfilled,GBP,540.00,2026-04-21 13:47:00 +0000,1,Falling Light - Framed,540.00,SKU,Mia Keller,Mia Keller,United Kingdom,repeat-collector
#AA10838,theo.molnar@example.com,paid,2026-04-21 14:54:00 +0000,unfulfilled,GBP,540.00,2026-04-21 14:54:00 +0000,1,Falling Light - Unframed,540.00,SKU,Theo Molnar,Theo Molnar,United Kingdom,
#AA10841,petra.andersen@example.com,paid,2026-04-21 15:01:00 +0000,unfulfilled,EUR,540.00,2026-04-21 15:01:00 +0000,1,Falling Light - Unframed,540.00,SKU,Petra Andersen,Petra Andersen,France,
#AA10842,stefan.costa@example.com,paid,2026-04-21 16:08:00 +0000,unfulfilled,USD,540.00,2026-04-21 16:08:00 +0000,1,Falling Light - Unframed,540.00,SKU,Stefan Costa,Stefan Costa,United States,
#AA10843,marta.sandberg@example.com,paid,2026-04-21 08:15:00 +0000,unfulfilled,EUR,540.00,2026-04-21 08:15:00 +0000,1,Falling Light - Framed,540.00,SKU,Marta Sandberg,Marta Sandberg,Italy,
#AA10844,isla.fontaine@example.com,paid,2026-04-21 09:22:00 +0000,unfulfilled,GBP,540.00,2026-04-21 09:22:00 +0000,1,Falling Light - Framed,540.00,SKU,Isla Fontaine,Isla Fontaine,United Kingdom,
#AA10845,petra.weber@example.com,paid,2026-04-21 10:29:00 +0000,unfulfilled,USD,540.00,2026-04-21 10:29:00 +0000,1,Falling Light - Framed,540.00,SKU,Petra Weber,Petra Weber,Canada,gift-order
#AA10848,idris.nakamura@example.com,paid,2026-04-22 11:36:00 +0000,unfulfilled,GBP,540.00,2026-04-22 11:36:00 +0000,1,Falling Light - Framed,540.00,SKU,Idris Nakamura,Idris Nakamura,United Kingdom,
#AA10849,mateo.oduya@example.com,paid,2026-04-22 12:43:00 +0000,unfulfilled,EUR,540.00,2026-04-22 12:43:00 +0000,1,Falling Light - Unframed,540.00,SKU,Mateo Oduya,Mateo Oduya,France,"vip,repeat-collector"
#AA10850,felix.rivera@example.com,paid,2026-04-22 13:50:00 +0000,unfulfilled,EUR,540.00,2026-04-22 13:50:00 +0000,1,Falling Light - Framed,540.00,SKU,Felix Rivera,Felix Rivera,Germany,
#AA10851,bo.ngata@example.com,paid,2026-04-22 14:57:00 +0000,unfulfilled,EUR,540.00,2026-04-22 14:57:00 +0000,1,Falling Light - Framed,540.00,SKU,Bo Ngata,Bo Ngata,Sweden,
#AA10852,elif.bakker@example.com,paid,2026-04-22 15:04:00 +0000,unfulfilled,EUR,540.00,2026-04-22 15:04:00 +0000,1,Falling Light - Framed,540.00,SKU,Elif Bakker,Elif Bakker,Italy,
#AA10853,aleksander.hassan@example.com,paid,2026-04-22 16:11:00 +0000,unfulfilled,GBP,540.00,2026-04-22 16:11:00 +0000,1,Falling Light - Unframed,540.00,SKU,Aleksander Hassan,Aleksander Hassan,United Kingdom,
#AA10856,ida.sorensen@example.com,paid,2026-04-22 08:18:00 +0000,unfulfilled,USD,540.00,2026-04-22 08:18:00 +0000,1,Falling Light - Framed,540.00,SKU,Ida Sorensen,Ida Sorensen,Canada,
#AA10857,yuki.oduya@example.com,paid,2026-04-22 09:25:00 +0000,unfulfilled,EUR,540.00,2026-04-22 09:25:00 +0000,1,Falling Light - Framed,540.00,SKU,Yuki Oduya,Yuki Oduya,Poland,
#AA10858,dmitri.andersen@example.com,paid,2026-04-22 10:32:00 +0000,unfulfilled,USD,540.00,2026-04-22 10:32:00 +0000,1,Falling Light - Unframed,540.00,SKU,Dmitri Andersen,Dmitri Andersen,United States,
#AA10859,diego.nakamura@example.com,paid,2026-04-23 11:39:00 +0000,unfulfilled,EUR,540.00,2026-04-23 11:39:00 +0000,1,Falling Light - Unframed,540.00,SKU,Diego Nakamura,Diego Nakamura,Netherlands,
#AA10860,signe.vermeer@example.com,paid,2026-04-23 12:46:00 +0000,unfulfilled,USD,540.00,2026-04-23 12:46:00 +0000,1,Falling Light - Unframed,540.00,SKU,Signe Vermeer,Signe Vermeer,United States,gift-order
#AA10861,freya.kaplan@example.com,paid,2026-04-23 13:53:00 +0000,unfulfilled,GBP,540.00,2026-04-23 13:53:00 +0000,1,Falling Light - Unframed,540.00,SKU,Freya Kaplan,Freya Kaplan,United Kingdom,
#AA10864,viktor.delgado@example.com,paid,2026-04-23 14:00:00 +0000,unfulfilled,EUR,540.00,2026-04-23 14:00:00 +0000,1,Falling Light - Unframed,540.00,SKU,Viktor Delgado,Viktor Delgado,Denmark,
#AA10866,lukas.blom@example.com,paid,2026-04-23 15:07:00 +0000,unfulfilled,EUR,540.00,2026-04-23 15:07:00 +0000,1,Falling Light - Unframed,540.00,SKU,Lukas Blom,Lukas Blom,France,
#AA10868,isla.brooks@example.com,paid,2026-04-23 16:14:00 +0000,unfulfilled,GBP,540.00,2026-04-23 16:14:00 +0000,1,Falling Light - Unframed,540.00,SKU,Isla Brooks,Isla Brooks,United Kingdom,
#AA10871,jan.berger@example.com,paid,2026-04-23 08:21:00 +0000,unfulfilled,GBP,540.00,2026-04-23 08:21:00 +0000,1,Falling Light - Framed,540.00,SKU,Jan Berger,Jan Berger,United Kingdom,repeat-collector
#AA10872,leila.diallo@example.com,paid,2026-04-23 09:28:00 +0000,unfulfilled,EUR,540.00,2026-04-23 09:28:00 +0000,1,Falling Light - Framed,540.00,SKU,Leila Diallo,Leila Diallo,Netherlands,gift-order
#AA10874,anya.berger@example.com,paid,2026-04-23 10:35:00 +0000,unfulfilled,USD,540.00,2026-04-23 10:35:00 +0000,1,Falling Light - Unframed,540.00,SKU,Anya Berger,Anya Berger,United States,
#AA10876,ethan.haugen@example.com,paid,2026-04-24 11:42:00 +0000,unfulfilled,EUR,540.00,2026-04-24 11:42:00 +0000,1,Falling Light - Framed,540.00,SKU,Ethan Haugen,Ethan Haugen,France,
#AA10879,dmitri.mensah@example.com,paid,2026-04-24 12:49:00 +0000,unfulfilled,EUR,540.00,2026-04-24 12:49:00 +0000,1,Falling Light - Unframed,540.00,SKU,Dmitri Mensah,Dmitri Mensah,France,
#AA10882,freya.rivera@example.com,paid,2026-04-24 13:56:00 +0000,unfulfilled,EUR,540.00,2026-04-24 13:56:00 +0000,1,Falling Light - Framed,540.00,SKU,Freya Rivera,Freya Rivera,Italy,first-order
#AA10883,liam.sorensen@example.com,paid,2026-04-24 14:03:00 +0000,unfulfilled,GBP,540.00,2026-04-24 14:03:00 +0000,1,Falling Light - Framed,540.00,SKU,Liam Sorensen,Liam Sorensen,United Kingdom,
#AA10886,idris.bakker@example.com,paid,2026-04-24 15:10:00 +0000,unfulfilled,EUR,540.00,2026-04-24 15:10:00 +0000,1,Falling Light - Framed,540.00,SKU,Idris Bakker,Idris Bakker,Denmark,
#AA10888,viktor.diallo@example.com,paid,2026-04-24 16:17:00 +0000,unfulfilled,USD,540.00,2026-04-24 16:17:00 +0000,1,Falling Light - Unframed,540.00,SKU,Viktor Diallo,Viktor Diallo,Japan,
#AA10889,milo.keller@example.com,paid,2026-04-24 08:24:00 +0000,unfulfilled,EUR,540.00,2026-04-24 08:24:00 +0000,1,Falling Light - Unframed,540.00,SKU,Milo Keller,Milo Keller,Denmark,newsletter
#AA10892,sven.raman@example.com,paid,2026-04-24 09:31:00 +0000,unfulfilled,GBP,540.00,2026-04-24 09:31:00 +0000,1,Falling Light - Unframed,540.00,SKU,Sven Raman,Sven Raman,United Kingdom,repeat-collector
#AA10893,jan.lange@example.com,paid,2026-04-24 10:38:00 +0000,unfulfilled,USD,540.00,2026-04-24 10:38:00 +0000,1,Falling Light - Unframed,540.00,SKU,Jan Lange,Jan Lange,United States,
#AA10895,iris.keller@example.com,paid,2026-04-25 11:45:00 +0000,unfulfilled,GBP,540.00,2026-04-25 11:45:00 +0000,1,Falling Light - Framed,540.00,SKU,Iris Keller,Iris Keller,United Kingdom,"vip,repeat-collector"
#AA10898,arthur.vos@example.com,paid,2026-04-25 12:52:00 +0000,unfulfilled,GBP,540.00,2026-04-25 12:52:00 +0000,1,Falling Light - Framed,540.00,SKU,Arthur Vos,Arthur Vos,United Kingdom,"vip,repeat-collector"
#AA10900,marta.falk@example.com,paid,2026-04-25 13:59:00 +0000,unfulfilled,GBP,540.00,2026-04-25 13:59:00 +0000,1,Falling Light - Framed,540.00,SKU,Marta Falk,Marta Falk,United Kingdom,repeat-collector
#AA10902,aya.okafor@example.com,paid,2026-04-25 14:06:00 +0000,unfulfilled,USD,540.00,2026-04-25 14:06:00 +0000,1,Falling Light - Framed,540.00,SKU,Aya Okafor,Aya Okafor,United States,
#AA10903,ines.haugen@example.com,paid,2026-04-25 15:13:00 +0000,unfulfilled,EUR,540.00,2026-04-25 15:13:00 +0000,1,Falling Light - Unframed,540.00,SKU,Ines Haugen,Ines Haugen,Germany,gift-order
#AA10904,roos.molnar@example.com,paid,2026-04-25 16:20:00 +0000,unfulfilled,EUR,540.00,2026-04-25 16:20:00 +0000,1,Falling Light - Framed,540.00,SKU,Roos Molnar,Roos Molnar,Germany,
#AA10905,viktor.aalto@example.com,paid,2026-04-25 08:27:00 +0000,unfulfilled,GBP,540.00,2026-04-25 08:27:00 +0000,1,Falling Light - Unframed,540.00,SKU,Viktor Aalto,Viktor Aalto,United Kingdom,
#AA10906,rafael.osei@example.com,paid,2026-04-25 09:34:00 +0000,unfulfilled,USD,540.00,2026-04-25 09:34:00 +0000,1,Falling Light - Framed,540.00,SKU,Rafael Osei,Rafael Osei,United States,
#AA10907,casper.acheampong@example.com,paid,2026-04-25 10:41:00 +0000,unfulfilled,EUR,540.00,2026-04-25 10:41:00 +0000,1,Falling Light - Unframed,540.00,SKU,Casper Acheampong,Casper Acheampong,Sweden,
#AA10910,jan.hoffmann@example.com,paid,2026-04-26 11:48:00 +0000,unfulfilled,EUR,540.00,2026-04-26 11:48:00 +0000,1,Falling Light - Framed,540.00,SKU,Jan Hoffmann,Jan Hoffmann,Netherlands,newsletter
#AA10913,signe.halvorsen@example.com,paid,2026-04-26 12:55:00 +0000,unfulfilled,EUR,540.00,2026-04-26 12:55:00 +0000,1,Falling Light - Unframed,540.00,SKU,Signe Halvorsen,Signe Halvorsen,Germany,"vip,repeat-collector"
#AA10914,priya.vermeer@example.com,paid,2026-04-26 13:02:00 +0000,unfulfilled,GBP,540.00,2026-04-26 13:02:00 +0000,1,Falling Light - Unframed,540.00,SKU,Priya Vermeer,Priya Vermeer,United Kingdom,
#AA10915,kai.gallagher@example.com,paid,2026-04-26 14:09:00 +0000,unfulfilled,GBP,540.00,2026-04-26 14:09:00 +0000,1,Falling Light - Unframed,540.00,SKU,Kai Gallagher,Kai Gallagher,United Kingdom,
`;

/**
 * A real-SHAPED export: how Avant Arte's Shopify actually names things.
 *
 * Written 31 Aug 2026, after the first genuine Shopify order exports reached
 * the project inside the edition-allocation workbook. Everything above this
 * was invented, and it invented the wrong convention — `Falling Light -
 * Framed` — so the framed/unframed split passed its tests for months and
 * would have put every real collector in the Unframed batch.
 *
 * What real exports do, and what this reproduces:
 *   - a line item's suffix is the SALES CHANNEL — "- Draw", "- Pre-order",
 *     "- Private", "- Public" — never the fulfilment;
 *   - **framing is a separate line item on the same order**, with its own SKU
 *     and its own price, whose title reads "White Abachi wood frame - UV
 *     protective acrylic". The word *framed* appears nowhere in the file;
 *   - SKUs are `ARTIST-ARTWORK-KIND-VARIANT`, where KIND is `FR` for a frame
 *     and `PE`/`TL` for a print, and `-UPGRADE` means museum-grade acrylic;
 *   - one release carries several artworks — three colourways here — and a
 *     collector may buy more than one in a single order;
 *   - a frame line whose print sits in another release's export (#RS2107),
 *     which is real and rare: two of 441 on the file this was drawn from.
 *
 * The collectors are fictional, as everywhere else in this file. The real
 * export carries live names, emails, postal addresses and phone numbers, and
 * none of that belongs in a repository.
 */
export const HARBOUR_LIGHT_CSV = `${HEADER}
#RS2101,elena.marchetti@example.com,paid,2026-05-02 09:12:04 +0000,unfulfilled,GBP,1240.00,2026-05-02 09:12:03 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Elena Marchetti,Elena Marchetti,United Kingdom,"framed,first-order"
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-BLACKABACH,,,,
#RS2102,tomas.b@example.org,paid,2026-05-02 09:31:47 +0000,unfulfilled,GBP,620.00,2026-05-02 09:31:46 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Tomas Brandt,Tomas Brandt,Germany,
#RS2103,aiko.tanaka@example.com,paid,2026-05-02 10:04:19 +0000,unfulfilled,GBP,1860.00,2026-05-02 10:04:18 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Aiko Tanaka,Aiko Tanaka,Japan,"vip,framed"
,,,,,,,,1,Harbour Light (Dusk) - White Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBK-FR-WHITEABACH-UPGRADE,,,,
,,,,,,,,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,,,,
#RS2104,priya.nair@example.com,paid,2026-05-02 11:22:58 +0000,unfulfilled,GBP,620.00,2026-05-02 11:22:57 +0000,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,Priya Nair,Priya Nair,India,
#RS2105,,paid,2026-05-02 12:40:11 +0000,unfulfilled,GBP,1240.00,2026-05-02 12:40:10 +0000,1,Harbour Light (Dusk) - Private,620.00,RSTON-HARBK-TL-PRIVATE,Nils Ferreira,Nils Ferreira,Portugal,framed
,,,,,,,,1,Harbour Light (Dusk) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBK-FR-NATURALABA,,,,
#RS2106,"okoro, chidi"@example.org,paid,2026-05-03 08:05:33 +0000,unfulfilled,GBP,620.00,2026-05-03 08:05:32 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,"Okoro, Chidi","Okoro, Chidi",Nigeria,
#RS2107,marion.lefevre@example.com,paid,2026-05-03 09:47:26 +0000,unfulfilled,GBP,740.00,2026-05-03 09:47:25 +0000,1,Night Garden - White Abachi wood frame - UV protective acrylic,740.00,RSTON-NIGHT-FR-WHITEABACH,Marion Lefevre,Marion Lefevre,France,framed
#RS2110,yannick.vasquez@example.com,paid,2026-05-03 09:00:00 +0000,unfulfilled,EUR,620.00,2026-05-03 09:00:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Yannick Vasquez,Yannick Vasquez,Denmark,first-time-buyer
#RS2111,franka.ostrowski@example.com,paid,2026-05-03 10:07:00 +0000,unfulfilled,GBP,620.00,2026-05-03 10:07:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Franka Ostrowski,Franka Ostrowski,United Kingdom,
#RS2112,xenia.castillo@example.com,paid,2026-05-03 11:14:00 +0000,unfulfilled,USD,620.00,2026-05-03 11:14:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Xenia Castillo,Xenia Castillo,United States,
#RS2113,quinn.grieg@example.com,paid,2026-05-04 12:21:00 +0000,unfulfilled,EUR,1240.00,2026-05-04 12:21:00 +0000,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,Quinn Grieg,Quinn Grieg,Denmark,framed
,,,,,,,,1,Harbour Light (Tide) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-NATURALABA,,,,
#RS2114,oona.halvorsen@example.com,paid,2026-05-04 13:28:00 +0000,unfulfilled,USD,620.00,2026-05-04 13:28:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Oona Halvorsen,Oona Halvorsen,United States,
#RS2115,otto.nyberg@example.com,paid,2026-05-05 14:35:00 +0000,unfulfilled,USD,620.00,2026-05-05 14:35:00 +0000,1,Harbour Light (Dusk) - Private,620.00,RSTON-HARBK-TL-PRIVATE,Otto Nyberg,Otto Nyberg,Japan,
#RS2116,celine.ostrowski@example.com,paid,2026-05-05 15:42:00 +0000,unfulfilled,EUR,620.00,2026-05-05 15:42:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Celine Ostrowski,Celine Ostrowski,France,
#RS2117,vera.toivonen@example.com,paid,2026-05-06 16:49:00 +0000,unfulfilled,USD,620.00,2026-05-06 16:49:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Vera Toivonen,Vera Toivonen,Japan,
#RS2118,farid.ibarra@example.com,paid,2026-05-06 17:56:00 +0000,unfulfilled,EUR,620.00,2026-05-06 17:56:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Farid Ibarra,Farid Ibarra,France,
#RS2119,franka.fontaine@example.com,paid,2026-05-07 09:03:00 +0000,unfulfilled,EUR,620.00,2026-05-07 09:03:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Franka Fontaine,Franka Fontaine,Germany,
#RS2120,beatriz.halvorsen@example.com,paid,2026-05-07 10:10:00 +0000,unfulfilled,EUR,620.00,2026-05-07 10:10:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Beatriz Halvorsen,Beatriz Halvorsen,Spain,
#RS2121,matteo.vasquez@example.com,paid,2026-05-08 11:17:00 +0000,unfulfilled,EUR,620.00,2026-05-08 11:17:00 +0000,1,Harbour Light (Dawn) - Private,620.00,RSTON-HARBD-TL-PRIVATE,Matteo Vasquez,Matteo Vasquez,Denmark,first-time-buyer
#RS2122,iker.bergstrom@example.com,paid,2026-05-08 12:24:00 +0000,unfulfilled,EUR,1240.00,2026-05-08 12:24:00 +0000,1,Harbour Light (Dusk) - Private,620.00,RSTON-HARBK-TL-PRIVATE,Iker Bergstrom,Iker Bergstrom,France,framed
,,,,,,,,1,Harbour Light (Dusk) - White Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBK-FR-WHITEABACH,,,,
#RS2123,vera.halvorsen@example.com,paid,2026-05-08 13:31:00 +0000,unfulfilled,EUR,620.00,2026-05-08 13:31:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Vera Halvorsen,Vera Halvorsen,France,
#RS2124,otto.grieg@example.com,paid,2026-05-09 14:38:00 +0000,unfulfilled,EUR,620.00,2026-05-09 14:38:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Otto Grieg,Otto Grieg,Portugal,first-time-buyer
#RS2125,gustav.grieg@example.com,paid,2026-05-09 15:45:00 +0000,unfulfilled,EUR,620.00,2026-05-09 15:45:00 +0000,1,Harbour Light (Tide) - Private,620.00,RSTON-HARBT-TL-PRIVATE,Gustav Grieg,Gustav Grieg,Sweden,
#RS2126,yannick.ibarra@example.com,paid,2026-05-10 16:52:00 +0000,unfulfilled,EUR,1240.00,2026-05-10 16:52:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Yannick Ibarra,Yannick Ibarra,France,framed
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-BLACKABACH,,,,
#RS2127,ulla.ulriksen@example.com,paid,2026-05-10 17:59:00 +0000,unfulfilled,EUR,1360.00,2026-05-10 17:59:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Ulla Ulriksen,Ulla Ulriksen,Italy,framed
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBD-FR-BLACKABACH-UPGRADE,,,,
#RS2128,delphine.lindholm@example.com,paid,2026-05-11 09:06:00 +0000,unfulfilled,EUR,620.00,2026-05-11 09:06:00 +0000,1,Harbour Light (Dusk) - Private,620.00,RSTON-HARBK-TL-PRIVATE,Delphine Lindholm,Delphine Lindholm,Denmark,vip
#RS2129,katja.sandoval@example.com,paid,2026-05-11 10:13:00 +0000,unfulfilled,GBP,620.00,2026-05-11 10:13:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Katja Sandoval,Katja Sandoval,United Kingdom,
#RS2130,ulla.ibarra@example.com,paid,2026-05-12 11:20:00 +0000,unfulfilled,USD,1360.00,2026-05-12 11:20:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Ulla Ibarra,Ulla Ibarra,Japan,"first-time-buyer,framed,vip"
,,,,,,,,1,Harbour Light (Tide) - Natural Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBT-FR-NATURALABA-UPGRADE,,,,
#RS2131,iker.toivonen@example.com,paid,2026-05-12 12:27:00 +0000,unfulfilled,EUR,1240.00,2026-05-12 12:27:00 +0000,2,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Iker Toivonen,Iker Toivonen,Belgium,
#RS2132,eamon.halvorsen@example.com,paid,2026-05-13 13:34:00 +0000,unfulfilled,USD,1360.00,2026-05-13 13:34:00 +0000,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,Eamon Halvorsen,Eamon Halvorsen,United States,"framed,vip"
,,,,,,,,1,Harbour Light (Tide) - Natural Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBT-FR-NATURALABA-UPGRADE,,,,
#RS2133,aksel.sandoval@example.com,paid,2026-05-13 14:41:00 +0000,unfulfilled,USD,620.00,2026-05-13 14:41:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Aksel Sandoval,Aksel Sandoval,Australia,
#RS2134,bastian.wexler@example.com,paid,2026-05-14 15:48:00 +0000,unfulfilled,USD,2480.00,2026-05-14 15:48:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Bastian Wexler,Bastian Wexler,Canada,"first-time-buyer,framed"
,,,,,,,,1,Harbour Light (Dawn) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-NATURALABA,,,,
,,,,,,,,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,,,,
,,,,,,,,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,,,,
#RS2135,quinn.lindholm@example.com,paid,2026-05-14 16:55:00 +0000,unfulfilled,EUR,620.00,2026-05-14 16:55:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Quinn Lindholm,Quinn Lindholm,Austria,
#RS2136,nikolai.toivonen@example.com,paid,2026-05-14 17:02:00 +0000,unfulfilled,EUR,620.00,2026-05-14 17:02:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Nikolai Toivonen,Nikolai Toivonen,Poland,
#RS2137,yara.grieg@example.com,paid,2026-05-15 09:09:00 +0000,unfulfilled,EUR,620.00,2026-05-15 09:09:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Yara Grieg,Yara Grieg,Poland,
#RS2138,thijs.nyberg@example.com,paid,2026-05-15 10:16:00 +0000,unfulfilled,EUR,1240.00,2026-05-15 10:16:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Thijs Nyberg,Thijs Nyberg,Portugal,framed
,,,,,,,,1,Harbour Light (Tide) - White Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-WHITEABACH,,,,
#RS2139,valentin.bianchi@example.com,paid,2026-05-16 11:23:00 +0000,unfulfilled,EUR,620.00,2026-05-16 11:23:00 +0000,1,Harbour Light (Dusk) - Private,620.00,RSTON-HARBK-TL-PRIVATE,Valentin Bianchi,Valentin Bianchi,Portugal,
#RS2140,ulla.ostrowski@example.com,paid,2026-05-16 12:30:00 +0000,unfulfilled,EUR,620.00,2026-05-16 12:30:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Ulla Ostrowski,Ulla Ostrowski,Belgium,first-time-buyer
#RS2141,corentin.eriksen@example.com,paid,2026-05-17 13:37:00 +0000,unfulfilled,EUR,620.00,2026-05-17 13:37:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Corentin Eriksen,Corentin Eriksen,Poland,
#RS2142,rasmus.sandoval@example.com,paid,2026-05-17 14:44:00 +0000,unfulfilled,EUR,620.00,2026-05-17 14:44:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Rasmus Sandoval,Rasmus Sandoval,Spain,
#RS2143,umberto.ibarra@example.com,paid,2026-05-18 15:51:00 +0000,unfulfilled,USD,620.00,2026-05-18 15:51:00 +0000,1,Harbour Light (Dusk) - Private,620.00,RSTON-HARBK-TL-PRIVATE,Umberto Ibarra,Umberto Ibarra,Australia,
#RS2144,tove.zetterberg@example.com,paid,2026-05-18 16:58:00 +0000,unfulfilled,GBP,620.00,2026-05-18 16:58:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Tove Zetterberg,Tove Zetterberg,United Kingdom,
#RS2145,zeno.lindholm@example.com,paid,2026-05-19 17:05:00 +0000,unfulfilled,EUR,620.00,2026-05-19 17:05:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Zeno Lindholm,Zeno Lindholm,Italy,
#RS2146,stellan.ulriksen@example.com,paid,2026-05-19 09:12:00 +0000,unfulfilled,EUR,620.00,2026-05-19 09:12:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Stellan Ulriksen,Stellan Ulriksen,Germany,
#RS2147,dmitri.wexler@example.com,paid,2026-05-19 10:19:00 +0000,unfulfilled,GBP,620.00,2026-05-19 10:19:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Dmitri Wexler,Dmitri Wexler,United Kingdom,
#RS2148,wiktor.ostrowski@example.com,paid,2026-05-20 11:26:00 +0000,unfulfilled,EUR,1240.00,2026-05-20 11:26:00 +0000,1,Harbour Light (Tide) - Private,620.00,RSTON-HARBT-TL-PRIVATE,Wiktor Ostrowski,Wiktor Ostrowski,Belgium,"first-time-buyer,framed"
,,,,,,,,1,Harbour Light (Tide) - White Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-WHITEABACH,,,,
#RS2149,pavel.halvorsen@example.com,paid,2026-05-20 12:33:00 +0000,unfulfilled,EUR,1360.00,2026-05-20 12:33:00 +0000,1,Harbour Light (Dawn) - Private,620.00,RSTON-HARBD-TL-PRIVATE,Pavel Halvorsen,Pavel Halvorsen,Netherlands,"framed,vip"
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBD-FR-BLACKABACH-UPGRADE,,,,
#RS2150,aksel.castillo@example.com,paid,2026-05-21 13:40:00 +0000,unfulfilled,EUR,1240.00,2026-05-21 13:40:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Aksel Castillo,Aksel Castillo,France,"first-time-buyer,framed"
,,,,,,,,1,Harbour Light (Dawn) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-NATURALABA,,,,
#RS2151,noor.ibarra@example.com,paid,2026-05-21 14:47:00 +0000,unfulfilled,EUR,1240.00,2026-05-21 14:47:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Noor Ibarra,Noor Ibarra,Belgium,framed
,,,,,,,,1,Harbour Light (Tide) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-BLACKABACH,,,,
#RS2152,paloma.toivonen@example.com,paid,2026-05-22 15:54:00 +0000,unfulfilled,USD,620.00,2026-05-22 15:54:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Paloma Toivonen,Paloma Toivonen,United States,
#RS2153,yara.halvorsen@example.com,paid,2026-05-22 16:01:00 +0000,unfulfilled,EUR,620.00,2026-05-22 16:01:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Yara Halvorsen,Yara Halvorsen,Poland,
#RS2154,pavel.dahlberg@example.com,paid,2026-05-23 17:08:00 +0000,unfulfilled,GBP,620.00,2026-05-23 17:08:00 +0000,1,Harbour Light (Dawn) - Private,620.00,RSTON-HARBD-TL-PRIVATE,Pavel Dahlberg,Pavel Dahlberg,United Kingdom,
#RS2155,jolanta.ostrowski@example.com,paid,2026-05-23 09:15:00 +0000,unfulfilled,EUR,620.00,2026-05-23 09:15:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Jolanta Ostrowski,Jolanta Ostrowski,Portugal,
#RS2156,zeno.grieg@example.com,paid,2026-05-24 10:22:00 +0000,unfulfilled,GBP,1240.00,2026-05-24 10:22:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Zeno Grieg,Zeno Grieg,United Kingdom,framed
,,,,,,,,1,Harbour Light (Tide) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-BLACKABACH,,,,
#RS2157,renate.jansen@example.com,paid,2026-05-24 11:29:00 +0000,unfulfilled,EUR,620.00,2026-05-24 11:29:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Renate Jansen,Renate Jansen,Poland,vip
#RS2158,katja.lindholm@example.com,paid,2026-05-25 12:36:00 +0000,unfulfilled,EUR,1360.00,2026-05-25 12:36:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Katja Lindholm,Katja Lindholm,Italy,framed
,,,,,,,,1,Harbour Light (Dawn) - Natural Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBD-FR-NATURALABA-UPGRADE,,,,
#RS2159,vera.abramsen@example.com,paid,2026-05-25 13:43:00 +0000,unfulfilled,EUR,1360.00,2026-05-25 13:43:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Vera Abramsen,Vera Abramsen,Austria,framed
,,,,,,,,1,Harbour Light (Tide) - Natural Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBT-FR-NATURALABA-UPGRADE,,,,
#RS2160,noor.castillo@example.com,paid,2026-05-25 14:50:00 +0000,unfulfilled,EUR,1240.00,2026-05-25 14:50:00 +0000,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,Noor Castillo,Noor Castillo,Spain,framed
,,,,,,,,1,Harbour Light (Tide) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-BLACKABACH,,,,
#RS2161,otto.bergstrom@example.com,paid,2026-05-26 15:57:00 +0000,unfulfilled,EUR,1240.00,2026-05-26 15:57:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Otto Bergstrom,Otto Bergstrom,Spain,"first-time-buyer,framed,vip"
,,,,,,,,1,Harbour Light (Dusk) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBK-FR-BLACKABACH,,,,
#RS2162,noor.nyberg@example.com,paid,2026-05-26 16:04:00 +0000,unfulfilled,EUR,1240.00,2026-05-26 16:04:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Noor Nyberg,Noor Nyberg,France,"framed,vip"
,,,,,,,,1,Harbour Light (Dawn) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-NATURALABA,,,,
#RS2163,ulla.jansen@example.com,paid,2026-05-27 17:11:00 +0000,unfulfilled,EUR,1240.00,2026-05-27 17:11:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Ulla Jansen,Ulla Jansen,Belgium,framed
,,,,,,,,1,Harbour Light (Tide) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-NATURALABA,,,,
#RS2164,xenia.ibarra@example.com,paid,2026-05-27 09:18:00 +0000,unfulfilled,EUR,620.00,2026-05-27 09:18:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Xenia Ibarra,Xenia Ibarra,Italy,first-time-buyer
#RS2165,xenia.halvorsen@example.com,paid,2026-05-28 10:25:00 +0000,unfulfilled,EUR,620.00,2026-05-28 10:25:00 +0000,1,Harbour Light (Tide) - Private,620.00,RSTON-HARBT-TL-PRIVATE,Xenia Halvorsen,Xenia Halvorsen,Spain,
#RS2166,thijs.abramsen@example.com,paid,2026-05-28 11:32:00 +0000,unfulfilled,EUR,620.00,2026-05-28 11:32:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Thijs Abramsen,Thijs Abramsen,France,
#RS2167,quinn.ulriksen@example.com,paid,2026-05-29 12:39:00 +0000,unfulfilled,EUR,620.00,2026-05-29 12:39:00 +0000,1,Harbour Light (Dawn) - Private,620.00,RSTON-HARBD-TL-PRIVATE,Quinn Ulriksen,Quinn Ulriksen,France,
#RS2168,valentin.grieg@example.com,paid,2026-05-29 13:46:00 +0000,unfulfilled,EUR,1360.00,2026-05-29 13:46:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Valentin Grieg,Valentin Grieg,Sweden,"framed,vip"
,,,,,,,,1,Harbour Light (Dawn) - White Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBD-FR-WHITEABACH-UPGRADE,,,,
#RS2169,delphine.abramsen@example.com,paid,2026-05-30 14:53:00 +0000,unfulfilled,EUR,620.00,2026-05-30 14:53:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Delphine Abramsen,Delphine Abramsen,Spain,
#RS2170,wiktor.bianchi@example.com,paid,2026-05-30 15:00:00 +0000,unfulfilled,EUR,1240.00,2026-05-30 15:00:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Wiktor Bianchi,Wiktor Bianchi,Belgium,"first-time-buyer,framed,vip"
,,,,,,,,1,Harbour Light (Dusk) - White Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBK-FR-WHITEABACH,,,,
#RS2171,quinn.halvorsen@example.com,paid,2026-05-30 16:07:00 +0000,unfulfilled,EUR,1240.00,2026-05-30 16:07:00 +0000,1,Harbour Light (Dusk) - Private,620.00,RSTON-HARBK-TL-PRIVATE,Quinn Halvorsen,Quinn Halvorsen,Italy,framed
,,,,,,,,1,Harbour Light (Dusk) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBK-FR-BLACKABACH,,,,
#RS2172,matteo.grieg@example.com,paid,2026-05-31 17:14:00 +0000,unfulfilled,EUR,1240.00,2026-05-31 17:14:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Matteo Grieg,Matteo Grieg,Italy,"first-time-buyer,framed,vip"
,,,,,,,,1,Harbour Light (Dawn) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-NATURALABA,,,,
#RS2173,umberto.lindholm@example.com,paid,2026-05-31 09:21:00 +0000,unfulfilled,USD,620.00,2026-05-31 09:21:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Umberto Lindholm,Umberto Lindholm,Japan,first-time-buyer
#RS2174,sanne.ulriksen@example.com,paid,2026-06-01 10:28:00 +0000,unfulfilled,EUR,620.00,2026-06-01 10:28:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Sanne Ulriksen,Sanne Ulriksen,Italy,first-time-buyer
#RS2175,thijs.engel@example.com,paid,2026-06-01 11:35:00 +0000,unfulfilled,EUR,620.00,2026-06-01 11:35:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Thijs Engel,Thijs Engel,Belgium,
#RS2176,yara.rousseau@example.com,paid,2026-06-02 12:42:00 +0000,unfulfilled,EUR,620.00,2026-06-02 12:42:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Yara Rousseau,Yara Rousseau,Spain,
#RS2177,zofia.rousseau@example.com,paid,2026-06-02 13:49:00 +0000,unfulfilled,EUR,1240.00,2026-06-02 13:49:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Zofia Rousseau,Zofia Rousseau,Belgium,framed
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-BLACKABACH,,,,
#RS2178,farid.aalto@example.com,paid,2026-06-03 14:56:00 +0000,unfulfilled,USD,1240.00,2026-06-03 14:56:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Farid Aalto,Farid Aalto,United States,framed
,,,,,,,,1,Harbour Light (Dawn) - White Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-WHITEABACH,,,,
#RS2179,umberto.grieg@example.com,paid,2026-06-03 15:03:00 +0000,unfulfilled,USD,620.00,2026-06-03 15:03:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Umberto Grieg,Umberto Grieg,Japan,
#RS2180,hugo.abramsen@example.com,paid,2026-06-04 16:10:00 +0000,unfulfilled,EUR,2600.00,2026-06-04 16:10:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Hugo Abramsen,Hugo Abramsen,Austria,framed
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBD-FR-BLACKABACH-UPGRADE,,,,
,,,,,,,,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,,,,
,,,,,,,,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,,,,
#RS2181,kasper.halvorsen@example.com,paid,2026-06-04 17:17:00 +0000,unfulfilled,USD,1240.00,2026-06-04 17:17:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Kasper Halvorsen,Kasper Halvorsen,Japan,"first-time-buyer,framed"
,,,,,,,,1,Harbour Light (Tide) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-NATURALABA,,,,
#RS2182,vera.aalto@example.com,paid,2026-06-05 09:24:00 +0000,unfulfilled,EUR,1240.00,2026-06-05 09:24:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Vera Aalto,Vera Aalto,France,"first-time-buyer,framed"
,,,,,,,,1,Harbour Light (Dawn) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-NATURALABA,,,,
#RS2183,bastian.corsten@example.com,paid,2026-06-05 10:31:00 +0000,unfulfilled,EUR,620.00,2026-06-05 10:31:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Bastian Corsten,Bastian Corsten,Italy,
#RS2184,yannick.rousseau@example.com,paid,2026-06-05 11:38:00 +0000,unfulfilled,USD,620.00,2026-06-05 11:38:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Yannick Rousseau,Yannick Rousseau,Australia,
#RS2185,xenia.abramsen@example.com,paid,2026-06-06 12:45:00 +0000,unfulfilled,EUR,1360.00,2026-06-06 12:45:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Xenia Abramsen,Xenia Abramsen,Austria,framed
,,,,,,,,1,Harbour Light (Dusk) - Black Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBK-FR-BLACKABACH-UPGRADE,,,,
#RS2186,lorenzo.dupont@example.com,paid,2026-06-06 13:52:00 +0000,unfulfilled,EUR,1240.00,2026-06-06 13:52:00 +0000,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,Lorenzo Dupont,Lorenzo Dupont,Italy,framed
,,,,,,,,1,Harbour Light (Tide) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-NATURALABA,,,,
#RS2187,lorenzo.dahlberg@example.com,paid,2026-06-07 14:59:00 +0000,unfulfilled,EUR,1240.00,2026-06-07 14:59:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Lorenzo Dahlberg,Lorenzo Dahlberg,Portugal,"first-time-buyer,framed"
,,,,,,,,1,Harbour Light (Dawn) - White Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-WHITEABACH,,,,
#RS2188,delphine.bergstrom@example.com,paid,2026-06-07 15:06:00 +0000,unfulfilled,EUR,1240.00,2026-06-07 15:06:00 +0000,2,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Delphine Bergstrom,Delphine Bergstrom,Belgium,
#RS2189,hugo.lindholm@example.com,paid,2026-06-08 16:13:00 +0000,unfulfilled,USD,1240.00,2026-06-08 16:13:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Hugo Lindholm,Hugo Lindholm,Canada,framed
,,,,,,,,1,Harbour Light (Dusk) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBK-FR-BLACKABACH,,,,
#RS2190,katja.abramsen@example.com,paid,2026-06-08 17:20:00 +0000,unfulfilled,USD,1240.00,2026-06-08 17:20:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Katja Abramsen,Katja Abramsen,Australia,framed
,,,,,,,,1,Harbour Light (Dawn) - White Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-WHITEABACH,,,,
#RS2191,iker.dupont@example.com,paid,2026-06-09 09:27:00 +0000,unfulfilled,EUR,1360.00,2026-06-09 09:27:00 +0000,1,Harbour Light (Dawn) - Private,620.00,RSTON-HARBD-TL-PRIVATE,Iker Dupont,Iker Dupont,Norway,"first-time-buyer,framed"
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBD-FR-BLACKABACH-UPGRADE,,,,
#RS2192,celine.kristensen@example.com,paid,2026-06-09 10:34:00 +0000,unfulfilled,EUR,620.00,2026-06-09 10:34:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Celine Kristensen,Celine Kristensen,Portugal,
#RS2193,hugo.ibarra@example.com,paid,2026-06-10 11:41:00 +0000,unfulfilled,EUR,1360.00,2026-06-10 11:41:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Hugo Ibarra,Hugo Ibarra,Netherlands,framed
,,,,,,,,1,Harbour Light (Dusk) - White Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBK-FR-WHITEABACH-UPGRADE,,,,
#RS2194,dmitri.eriksen@example.com,paid,2026-06-10 12:48:00 +0000,unfulfilled,EUR,1360.00,2026-06-10 12:48:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Dmitri Eriksen,Dmitri Eriksen,Italy,framed
,,,,,,,,1,Harbour Light (Dawn) - White Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBD-FR-WHITEABACH-UPGRADE,,,,
#RS2195,zofia.kristensen@example.com,paid,2026-06-10 13:55:00 +0000,unfulfilled,EUR,620.00,2026-06-10 13:55:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Zofia Kristensen,Zofia Kristensen,Denmark,
#RS2196,ulla.dahlberg@example.com,paid,2026-06-11 14:02:00 +0000,unfulfilled,EUR,620.00,2026-06-11 14:02:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Ulla Dahlberg,Ulla Dahlberg,Ireland,
#RS2197,yara.fontaine@example.com,paid,2026-06-11 15:09:00 +0000,unfulfilled,USD,1360.00,2026-06-11 15:09:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Yara Fontaine,Yara Fontaine,United States,"first-time-buyer,framed"
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBD-FR-BLACKABACH-UPGRADE,,,,
#RS2198,xenia.zetterberg@example.com,paid,2026-06-12 16:16:00 +0000,unfulfilled,EUR,1240.00,2026-06-12 16:16:00 +0000,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,Xenia Zetterberg,Xenia Zetterberg,Denmark,framed
,,,,,,,,1,Harbour Light (Dawn) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-NATURALABA,,,,
#RS2199,gustav.toivonen@example.com,paid,2026-06-12 17:23:00 +0000,unfulfilled,USD,620.00,2026-06-12 17:23:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Gustav Toivonen,Gustav Toivonen,Australia,
#RS2200,dmitri.halvorsen@example.com,paid,2026-06-13 09:30:00 +0000,unfulfilled,EUR,620.00,2026-06-13 09:30:00 +0000,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,Dmitri Halvorsen,Dmitri Halvorsen,Germany,
#RS2201,rasmus.kristensen@example.com,paid,2026-06-13 10:37:00 +0000,unfulfilled,EUR,620.00,2026-06-13 10:37:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Rasmus Kristensen,Rasmus Kristensen,Norway,
#RS2202,vera.lindholm@example.com,paid,2026-06-14 11:44:00 +0000,unfulfilled,EUR,620.00,2026-06-14 11:44:00 +0000,1,Harbour Light (Dawn) - Private,620.00,RSTON-HARBD-TL-PRIVATE,Vera Lindholm,Vera Lindholm,Belgium,
#RS2203,zofia.toivonen@example.com,paid,2026-06-14 12:51:00 +0000,unfulfilled,USD,620.00,2026-06-14 12:51:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Zofia Toivonen,Zofia Toivonen,Japan,
#RS2204,pavel.eriksen@example.com,paid,2026-06-15 13:58:00 +0000,unfulfilled,GBP,1860.00,2026-06-15 13:58:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Pavel Eriksen,Pavel Eriksen,United Kingdom,framed
,,,,,,,,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,,,,
,,,,,,,,1,Harbour Light (Tide) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-BLACKABACH,,,,
#RS2205,greta.kristensen@example.com,paid,2026-06-15 14:05:00 +0000,unfulfilled,USD,1860.00,2026-06-15 14:05:00 +0000,1,Harbour Light (Tide) - Private,620.00,RSTON-HARBT-TL-PRIVATE,Greta Kristensen,Greta Kristensen,United States,framed
,,,,,,,,1,Harbour Light (Tide) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-BLACKABACH,,,,
,,,,,,,,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,,,,
#RS2206,noor.ylonen@example.com,paid,2026-06-16 15:12:00 +0000,unfulfilled,EUR,1860.00,2026-06-16 15:12:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Noor Ylonen,Noor Ylonen,Spain,framed
,,,,,,,,1,Harbour Light (Tide) - White Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-WHITEABACH,,,,
,,,,,,,,1,Harbour Light (Dawn) - Private,620.00,RSTON-HARBD-TL-PRIVATE,,,,
#RS2207,greta.sandoval@example.com,paid,2026-06-16 16:19:00 +0000,unfulfilled,USD,1240.00,2026-06-16 16:19:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Greta Sandoval,Greta Sandoval,United States,vip
,,,,,,,,1,Harbour Light (Tide) - Private,620.00,RSTON-HARBT-TL-PRIVATE,,,,
#RS2208,valentin.aalto@example.com,paid,2026-06-16 17:26:00 +0000,unfulfilled,EUR,1860.00,2026-06-16 17:26:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Valentin Aalto,Valentin Aalto,Austria,framed
,,,,,,,,1,Harbour Light (Dusk) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBK-FR-BLACKABACH,,,,
,,,,,,,,1,Harbour Light (Dawn) - Private,620.00,RSTON-HARBD-TL-PRIVATE,,,,
#RS2209,aksel.bergstrom@example.com,paid,2026-06-17 09:33:00 +0000,unfulfilled,EUR,1860.00,2026-06-17 09:33:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Aksel Bergstrom,Aksel Bergstrom,Netherlands,framed
,,,,,,,,1,Harbour Light (Tide) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-BLACKABACH,,,,
,,,,,,,,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,,,,
#RS2210,linnea.aalto@example.com,paid,2026-06-17 10:40:00 +0000,unfulfilled,EUR,1860.00,2026-06-17 10:40:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Linnea Aalto,Linnea Aalto,Italy,framed
,,,,,,,,1,Harbour Light (Dusk) - White Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBK-FR-WHITEABACH,,,,
,,,,,,,,1,Harbour Light (Tide) - Private,620.00,RSTON-HARBT-TL-PRIVATE,,,,
#RS2211,hugo.zetterberg@example.com,paid,2026-06-18 11:47:00 +0000,unfulfilled,EUR,1240.00,2026-06-18 11:47:00 +0000,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,Hugo Zetterberg,Hugo Zetterberg,France,
,,,,,,,,1,Harbour Light (Dusk) - Private,620.00,RSTON-HARBK-TL-PRIVATE,,,,
#RS2212,wanda.ulriksen@example.com,paid,2026-06-18 12:54:00 +0000,unfulfilled,EUR,1240.00,2026-06-18 12:54:00 +0000,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,Wanda Ulriksen,Wanda Ulriksen,Ireland,
,,,,,,,,1,Harbour Light (Dawn) - Public,620.00,RSTON-HARBD-TL-PUBLIC,,,,
#RS2213,ulla.lindholm@example.com,paid,2026-06-19 13:01:00 +0000,unfulfilled,EUR,2600.00,2026-06-19 13:01:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Ulla Lindholm,Ulla Lindholm,Belgium,framed
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBD-FR-BLACKABACH-UPGRADE,,,,
,,,,,,,,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,,,,
,,,,,,,,1,Harbour Light (Tide) - White Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-WHITEABACH,,,,
#RS2214,hilde.ylonen@example.com,paid,2026-06-19 14:08:00 +0000,unfulfilled,EUR,2480.00,2026-06-19 14:08:00 +0000,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,Hilde Ylonen,Hilde Ylonen,Spain,"first-time-buyer,framed"
,,,,,,,,1,Harbour Light (Tide) - Natural Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBT-FR-NATURALABA,,,,
,,,,,,,,1,Harbour Light (Dawn) - Private,620.00,RSTON-HARBD-TL-PRIVATE,,,,
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-BLACKABACH,,,,
#RS2215,oona.zetterberg@example.com,paid,2026-06-20 15:15:00 +0000,unfulfilled,GBP,1980.00,2026-06-20 15:15:00 +0000,1,Harbour Light (Tide) - Private,620.00,RSTON-HARBT-TL-PRIVATE,Oona Zetterberg,Oona Zetterberg,United Kingdom,framed
,,,,,,,,1,Harbour Light (Tide) - Natural Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBT-FR-NATURALABA-UPGRADE,,,,
,,,,,,,,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,,,,
#RS2216,gustav.dahlberg@example.com,paid,2026-06-20 16:22:00 +0000,unfulfilled,EUR,1980.00,2026-06-20 16:22:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Gustav Dahlberg,Gustav Dahlberg,Denmark,framed
,,,,,,,,1,Harbour Light (Dusk) - Natural Abachi wood frame - Museum-grade acrylic,740.00,RSTON-HARBK-FR-NATURALABA-UPGRADE,,,,
,,,,,,,,1,Harbour Light (Dawn) - Private,620.00,RSTON-HARBD-TL-PRIVATE,,,,
#RS2217,celine.abramsen@example.com,paid,2026-06-21 17:29:00 +0000,unfulfilled,EUR,1240.00,2026-06-21 17:29:00 +0000,1,Harbour Light (Dusk) - Public,620.00,RSTON-HARBK-TL-PUBLIC,Celine Abramsen,Celine Abramsen,Norway,
,,,,,,,,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,,,,
#RS2218,gustav.ibarra@example.com,paid,2026-06-21 09:36:00 +0000,unfulfilled,USD,1860.00,2026-06-21 09:36:00 +0000,1,Harbour Light (Dawn) - Pre-order,620.00,RSTON-HARBD-TL-PREORDER,Gustav Ibarra,Gustav Ibarra,Australia,framed
,,,,,,,,1,Harbour Light (Dawn) - Black Abachi wood frame - UV protective acrylic,620.00,RSTON-HARBD-FR-BLACKABACH,,,,
,,,,,,,,1,Harbour Light (Tide) - Pre-order,620.00,RSTON-HARBT-TL-PREORDER,,,,
#RS2219,zofia.jansen@example.com,paid,2026-06-21 10:43:00 +0000,unfulfilled,EUR,1240.00,2026-06-21 10:43:00 +0000,1,Harbour Light (Dusk) - Pre-order,620.00,RSTON-HARBK-TL-PREORDER,Zofia Jansen,Zofia Jansen,Portugal,vip
,,,,,,,,1,Harbour Light (Tide) - Public,620.00,RSTON-HARBT-TL-PUBLIC,,,,`;

export const VESSEL_VIII_CSV = `${HEADER}
#AA10501,imogen.clarke@example.com,paid,2026-04-02 09:10:00 +0100,unfulfilled,GBP,2400.00,2026-04-02 09:10:00 +0100,1,Vessel VIII,2400.00,V8,Imogen Clarke,Imogen Clarke,United Kingdom,
#AA10502,henrik.dahl@example.com,paid,2026-04-02 09:32:00 +0100,unfulfilled,EUR,2400.00,2026-04-02 09:32:00 +0100,1,Vessel VIII,2400.00,V8,Henrik Dahl,Henrik Dahl,France,first-order
#AA10503,mei.wong@example.org,paid,2026-04-02 10:05:00 +0100,unfulfilled,GBP,2400.00,2026-04-02 10:05:00 +0100,1,Vessel VIII,2400.00,V8,Mei Wong,Mei Wong,United Kingdom,"vip,framed-upgrade"
#AA10504,arthur.beaumont@example.net,paid,2026-04-02 10:41:00 +0100,unfulfilled,GBP,2400.00,2026-04-02 10:41:00 +0100,1,Vessel VIII,2400.00,V8,Arthur Beaumont,Arthur Beaumont,United Kingdom,
#AA10505,lucia.ferrari@example.com,paid,2026-04-02 11:20:00 +0100,unfulfilled,EUR,2400.00,2026-04-02 11:20:00 +0100,1,Vessel VIII,2400.00,V8,Lucia Ferrari,Lucia Ferrari,Germany,repeat-collector
#AA10506,jonas.weber@example.com,paid,2026-04-03 08:15:00 +0100,unfulfilled,EUR,2400.00,2026-04-03 08:15:00 +0100,1,Vessel VIII,2400.00,V8,Jonas Weber,Jonas Weber,Italy,
#AA10507,sarah.mbeki@example.com,paid,2026-04-03 09:48:00 +0100,unfulfilled,GBP,2400.00,2026-04-03 09:48:00 +0100,1,Vessel VIII,2400.00,V8,Sarah Mbeki,Sarah Mbeki,United Kingdom,vip
#AA10508,pieter.janssen@example.com,paid,2026-04-04 12:02:00 +0100,unfulfilled,EUR,2400.00,2026-04-04 12:02:00 +0100,1,Vessel VIII,2400.00,V8,Pieter Janssen,Pieter Janssen,Spain,repeat-collector
#AA10521,liam.rossi@example.com,paid,2026-04-07 08:00:00 +0000,unfulfilled,EUR,2400.00,2026-04-07 08:00:00 +0000,1,Vessel VIII,2400.00,SKU,Liam Rossi,Liam Rossi,Germany,
#AA10523,maya.jimenez@example.com,paid,2026-04-07 09:07:00 +0000,unfulfilled,EUR,2400.00,2026-04-07 09:07:00 +0000,1,Vessel VIII,2400.00,SKU,Maya Jimenez,Maya Jimenez,Germany,
#AA10524,oscar.bianchi@example.com,paid,2026-04-07 10:14:00 +0000,unfulfilled,EUR,2400.00,2026-04-07 10:14:00 +0000,1,Vessel VIII,2400.00,SKU,Oscar Bianchi,Oscar Bianchi,Poland,
#AA10525,ines.jimenez@example.com,paid,2026-04-07 11:21:00 +0000,unfulfilled,EUR,2400.00,2026-04-07 11:21:00 +0000,1,Vessel VIII,2400.00,SKU,Ines Jimenez,Ines Jimenez,Italy,
#AA10526,sven.hoffmann@example.com,paid,2026-04-07 12:28:00 +0000,unfulfilled,GBP,2400.00,2026-04-07 12:28:00 +0000,1,Vessel VIII,2400.00,SKU,Sven Hoffmann,Sven Hoffmann,United Kingdom,vip
#AA10527,solveig.marchetti@example.com,paid,2026-04-07 13:35:00 +0000,unfulfilled,EUR,2400.00,2026-04-07 13:35:00 +0000,1,Vessel VIII,2400.00,SKU,Solveig Marchetti,Solveig Marchetti,Germany,
#AA10529,bram.ngata@example.com,paid,2026-04-07 14:42:00 +0000,unfulfilled,EUR,2400.00,2026-04-07 14:42:00 +0000,1,Vessel VIII,2400.00,SKU,Bram Ngata,Bram Ngata,Germany,
#AA10530,aya.sandberg@example.com,paid,2026-04-07 15:49:00 +0000,unfulfilled,USD,2400.00,2026-04-07 15:49:00 +0000,1,Vessel VIII,2400.00,SKU,Aya Sandberg,Aya Sandberg,United States,newsletter
#AA10531,yuki.rivera@example.com,paid,2026-04-07 16:56:00 +0000,unfulfilled,GBP,2400.00,2026-04-07 16:56:00 +0000,1,Vessel VIII,2400.00,SKU,Yuki Rivera,Yuki Rivera,United Kingdom,
#AA10534,elena.moreau@example.com,paid,2026-04-07 08:03:00 +0000,unfulfilled,EUR,2400.00,2026-04-07 08:03:00 +0000,1,Vessel VIII,2400.00,SKU,Elena Moreau,Elena Moreau,Sweden,
#AA10536,elena.lange@example.com,paid,2026-04-08 09:10:00 +0000,unfulfilled,USD,2400.00,2026-04-08 09:10:00 +0000,1,Vessel VIII,2400.00,SKU,Elena Lange,Elena Lange,United States,repeat-collector
#AA10539,mia.sorensen@example.com,paid,2026-04-08 10:17:00 +0000,unfulfilled,GBP,2400.00,2026-04-08 10:17:00 +0000,1,Vessel VIII,2400.00,SKU,Mia Sorensen,Mia Sorensen,United Kingdom,newsletter
#AA10540,maya.acheampong@example.com,paid,2026-04-08 11:24:00 +0000,unfulfilled,GBP,2400.00,2026-04-08 11:24:00 +0000,1,Vessel VIII,2400.00,SKU,Maya Acheampong,Maya Acheampong,United Kingdom,repeat-collector
#AA10541,theo.halvorsen@example.com,paid,2026-04-08 12:31:00 +0000,unfulfilled,EUR,2400.00,2026-04-08 12:31:00 +0000,1,Vessel VIII,2400.00,SKU,Theo Halvorsen,Theo Halvorsen,Germany,
#AA10544,milo.kaplan@example.com,paid,2026-04-08 13:38:00 +0000,unfulfilled,GBP,2400.00,2026-04-08 13:38:00 +0000,1,Vessel VIII,2400.00,SKU,Milo Kaplan,Milo Kaplan,United Kingdom,first-order
#AA10545,liam.bianchi@example.com,paid,2026-04-08 14:45:00 +0000,unfulfilled,GBP,2400.00,2026-04-08 14:45:00 +0000,1,Vessel VIII,2400.00,SKU,Liam Bianchi,Liam Bianchi,United Kingdom,
#AA10546,aleksander.okonkwo@example.com,paid,2026-04-08 15:52:00 +0000,unfulfilled,GBP,2400.00,2026-04-08 15:52:00 +0000,1,Vessel VIII,2400.00,SKU,Aleksander Okonkwo,Aleksander Okonkwo,United Kingdom,vip
#AA10547,marco.delgado@example.com,paid,2026-04-08 16:59:00 +0000,unfulfilled,GBP,2400.00,2026-04-08 16:59:00 +0000,1,Vessel VIII,2400.00,SKU,Marco Delgado,Marco Delgado,United Kingdom,repeat-collector
#AA10548,casper.whitfield@example.com,paid,2026-04-08 08:06:00 +0000,unfulfilled,EUR,2400.00,2026-04-08 08:06:00 +0000,1,Vessel VIII,2400.00,SKU,Casper Whitfield,Casper Whitfield,Italy,vip
#AA10550,malik.toft@example.com,paid,2026-04-09 09:13:00 +0000,unfulfilled,EUR,2400.00,2026-04-09 09:13:00 +0000,1,Vessel VIII,2400.00,SKU,Malik Toft,Malik Toft,Netherlands,
#AA10551,amara.okafor@example.com,paid,2026-04-09 10:20:00 +0000,unfulfilled,EUR,2400.00,2026-04-09 10:20:00 +0000,1,Vessel VIII,2400.00,SKU,Amara Okafor,Amara Okafor,France,
#AA10552,bram.halvorsen@example.com,paid,2026-04-09 11:27:00 +0000,unfulfilled,USD,2400.00,2026-04-09 11:27:00 +0000,1,Vessel VIII,2400.00,SKU,Bram Halvorsen,Bram Halvorsen,United States,gift-order
#AA10554,dmitri.diallo@example.com,paid,2026-04-09 12:34:00 +0000,unfulfilled,GBP,2400.00,2026-04-09 12:34:00 +0000,1,Vessel VIII,2400.00,SKU,Dmitri Diallo,Dmitri Diallo,United Kingdom,
#AA10555,iris.nurmi@example.com,paid,2026-04-09 13:41:00 +0000,unfulfilled,GBP,2400.00,2026-04-09 13:41:00 +0000,1,Vessel VIII,2400.00,SKU,Iris Nurmi,Iris Nurmi,United Kingdom,
#AA10557,theo.bakker@example.com,paid,2026-04-09 14:48:00 +0000,unfulfilled,GBP,2400.00,2026-04-09 14:48:00 +0000,1,Vessel VIII,2400.00,SKU,Theo Bakker,Theo Bakker,United Kingdom,newsletter
#AA10559,hana.keller@example.com,paid,2026-04-09 15:55:00 +0000,unfulfilled,EUR,2400.00,2026-04-09 15:55:00 +0000,1,Vessel VIII,2400.00,SKU,Hana Keller,Hana Keller,France,
#AA10560,ines.acheampong@example.com,paid,2026-04-09 16:02:00 +0000,unfulfilled,EUR,2400.00,2026-04-09 16:02:00 +0000,1,Vessel VIII,2400.00,SKU,Ines Acheampong,Ines Acheampong,Netherlands,
#AA10561,otto.dubois@example.com,paid,2026-04-09 08:09:00 +0000,unfulfilled,EUR,2400.00,2026-04-09 08:09:00 +0000,1,Vessel VIII,2400.00,SKU,Otto Dubois,Otto Dubois,Poland,repeat-collector
#AA10564,bruno.mensah@example.com,paid,2026-04-10 09:16:00 +0000,unfulfilled,EUR,2400.00,2026-04-10 09:16:00 +0000,1,Vessel VIII,2400.00,SKU,Bruno Mensah,Bruno Mensah,Germany,
#AA10567,mattia.tanaka@example.com,paid,2026-04-10 10:23:00 +0000,unfulfilled,EUR,2400.00,2026-04-10 10:23:00 +0000,1,Vessel VIII,2400.00,SKU,Mattia Tanaka,Mattia Tanaka,Netherlands,
#AA10568,arthur.oduya@example.com,paid,2026-04-10 11:30:00 +0000,unfulfilled,EUR,2400.00,2026-04-10 11:30:00 +0000,1,Vessel VIII,2400.00,SKU,Arthur Oduya,Arthur Oduya,Denmark,"vip,repeat-collector"
#AA10570,petra.iversen@example.com,paid,2026-04-10 12:37:00 +0000,unfulfilled,EUR,2400.00,2026-04-10 12:37:00 +0000,1,Vessel VIII,2400.00,SKU,Petra Iversen,Petra Iversen,Netherlands,
#AA10573,leila.petersen@example.com,paid,2026-04-10 13:44:00 +0000,unfulfilled,GBP,2400.00,2026-04-10 13:44:00 +0000,1,Vessel VIII,2400.00,SKU,Leila Petersen,Leila Petersen,United Kingdom,"vip,repeat-collector"
#AA10574,jan.silva@example.com,paid,2026-04-10 14:51:00 +0000,unfulfilled,EUR,2400.00,2026-04-10 14:51:00 +0000,1,Vessel VIII,2400.00,SKU,Jan Silva,Jan Silva,Italy,
#AA10575,rafael.silva@example.com,paid,2026-04-10 15:58:00 +0000,unfulfilled,EUR,2400.00,2026-04-10 15:58:00 +0000,1,Vessel VIII,2400.00,SKU,Rafael Silva,Rafael Silva,Germany,
#AA10576,signe.delgado@example.com,paid,2026-04-10 16:05:00 +0000,unfulfilled,GBP,2400.00,2026-04-10 16:05:00 +0000,1,Vessel VIII,2400.00,SKU,Signe Delgado,Signe Delgado,United Kingdom,
#AA10579,milo.vermeer@example.com,paid,2026-04-10 08:12:00 +0000,unfulfilled,USD,2400.00,2026-04-10 08:12:00 +0000,1,Vessel VIII,2400.00,SKU,Milo Vermeer,Milo Vermeer,United States,"vip,repeat-collector"
#AA10580,diego.bakker@example.com,paid,2026-04-11 09:19:00 +0000,unfulfilled,EUR,2400.00,2026-04-11 09:19:00 +0000,1,Vessel VIII,2400.00,SKU,Diego Bakker,Diego Bakker,France,
#AA10582,henrik.aalto@example.com,paid,2026-04-11 10:26:00 +0000,unfulfilled,EUR,2400.00,2026-04-11 10:26:00 +0000,1,Vessel VIII,2400.00,SKU,Henrik Aalto,Henrik Aalto,Sweden,
#AA10583,malik.berger@example.com,paid,2026-04-11 11:33:00 +0000,unfulfilled,EUR,2400.00,2026-04-11 11:33:00 +0000,1,Vessel VIII,2400.00,SKU,Malik Berger,Malik Berger,Germany,newsletter
#AA10584,bruno.halvorsen@example.com,paid,2026-04-11 12:40:00 +0000,unfulfilled,GBP,2400.00,2026-04-11 12:40:00 +0000,1,Vessel VIII,2400.00,SKU,Bruno Halvorsen,Bruno Halvorsen,United Kingdom,
#AA10587,aya.silva@example.com,paid,2026-04-11 13:47:00 +0000,unfulfilled,EUR,2400.00,2026-04-11 13:47:00 +0000,1,Vessel VIII,2400.00,SKU,Aya Silva,Aya Silva,Netherlands,
#AA10588,lena.aalto@example.com,paid,2026-04-11 14:54:00 +0000,unfulfilled,USD,2400.00,2026-04-11 14:54:00 +0000,1,Vessel VIII,2400.00,SKU,Lena Aalto,Lena Aalto,United States,first-order
#AA10590,kai.tanaka@example.com,paid,2026-04-11 15:01:00 +0000,unfulfilled,GBP,2400.00,2026-04-11 15:01:00 +0000,1,Vessel VIII,2400.00,SKU,Kai Tanaka,Kai Tanaka,United Kingdom,"vip,repeat-collector"
#AA10592,sanne.mensah@example.com,paid,2026-04-11 16:08:00 +0000,unfulfilled,USD,2400.00,2026-04-11 16:08:00 +0000,1,Vessel VIII,2400.00,SKU,Sanne Mensah,Sanne Mensah,Australia,"vip,repeat-collector"
#AA10593,joris.ferreira@example.com,paid,2026-04-11 08:15:00 +0000,unfulfilled,EUR,2400.00,2026-04-11 08:15:00 +0000,1,Vessel VIII,2400.00,SKU,Joris Ferreira,Joris Ferreira,Poland,
#AA10594,lukas.aalto@example.com,paid,2026-04-12 09:22:00 +0000,unfulfilled,EUR,2400.00,2026-04-12 09:22:00 +0000,1,Vessel VIII,2400.00,SKU,Lukas Aalto,Lukas Aalto,Germany,
#AA10597,bruno.larsen@example.com,paid,2026-04-12 10:29:00 +0000,unfulfilled,USD,2400.00,2026-04-12 10:29:00 +0000,1,Vessel VIII,2400.00,SKU,Bruno Larsen,Bruno Larsen,United States,first-order
#AA10598,lucia.berger@example.com,paid,2026-04-12 11:36:00 +0000,unfulfilled,EUR,2400.00,2026-04-12 11:36:00 +0000,1,Vessel VIII,2400.00,SKU,Lucia Berger,Lucia Berger,Germany,
#AA10601,otto.haugen@example.com,paid,2026-04-12 12:43:00 +0000,unfulfilled,EUR,2400.00,2026-04-12 12:43:00 +0000,1,Vessel VIII,2400.00,SKU,Otto Haugen,Otto Haugen,Germany,
#AA10603,leila.molnar@example.com,paid,2026-04-12 13:50:00 +0000,unfulfilled,EUR,2400.00,2026-04-12 13:50:00 +0000,1,Vessel VIII,2400.00,SKU,Leila Molnar,Leila Molnar,Netherlands,"vip,repeat-collector"
#AA10604,jan.okonkwo@example.com,paid,2026-04-12 14:57:00 +0000,unfulfilled,GBP,2400.00,2026-04-12 14:57:00 +0000,1,Vessel VIII,2400.00,SKU,Jan Okonkwo,Jan Okonkwo,United Kingdom,vip
#AA10605,tomas.silva@example.com,paid,2026-04-12 15:04:00 +0000,unfulfilled,GBP,2400.00,2026-04-12 15:04:00 +0000,1,Vessel VIII,2400.00,SKU,Tomas Silva,Tomas Silva,United Kingdom,
#AA10606,oscar.hart@example.com,paid,2026-04-12 16:11:00 +0000,unfulfilled,GBP,2400.00,2026-04-12 16:11:00 +0000,1,Vessel VIII,2400.00,SKU,Oscar Hart,Oscar Hart,United Kingdom,
#AA10607,arthur.ngata@example.com,paid,2026-04-12 08:18:00 +0000,unfulfilled,EUR,2400.00,2026-04-12 08:18:00 +0000,1,Vessel VIII,2400.00,SKU,Arthur Ngata,Arthur Ngata,Germany,gift-order
#AA10609,elif.jimenez@example.com,paid,2026-04-13 09:25:00 +0000,unfulfilled,EUR,2400.00,2026-04-13 09:25:00 +0000,1,Vessel VIII,2400.00,SKU,Elif Jimenez,Elif Jimenez,Germany,
#AA10610,jonas.blom@example.com,paid,2026-04-13 10:32:00 +0000,unfulfilled,EUR,2400.00,2026-04-13 10:32:00 +0000,1,Vessel VIII,2400.00,SKU,Jonas Blom,Jonas Blom,France,"vip,repeat-collector"
#AA10613,olivia.hart@example.com,paid,2026-04-13 11:39:00 +0000,unfulfilled,GBP,2400.00,2026-04-13 11:39:00 +0000,1,Vessel VIII,2400.00,SKU,Olivia Hart,Olivia Hart,United Kingdom,first-order
#AA10614,liam.rasmussen@example.com,paid,2026-04-13 12:46:00 +0000,unfulfilled,EUR,2400.00,2026-04-13 12:46:00 +0000,1,Vessel VIII,2400.00,SKU,Liam Rasmussen,Liam Rasmussen,Germany,
#AA10616,yuki.sorensen@example.com,paid,2026-04-13 13:53:00 +0000,unfulfilled,GBP,2400.00,2026-04-13 13:53:00 +0000,1,Vessel VIII,2400.00,SKU,Yuki Sorensen,Yuki Sorensen,United Kingdom,
#AA10617,diego.rasmussen@example.com,paid,2026-04-13 14:00:00 +0000,unfulfilled,GBP,2400.00,2026-04-13 14:00:00 +0000,1,Vessel VIII,2400.00,SKU,Diego Rasmussen,Diego Rasmussen,United Kingdom,
#AA10620,jan.tanaka@example.com,paid,2026-04-13 15:07:00 +0000,unfulfilled,GBP,2400.00,2026-04-13 15:07:00 +0000,1,Vessel VIII,2400.00,SKU,Jan Tanaka,Jan Tanaka,United Kingdom,
#AA10621,anders.brand@example.com,paid,2026-04-13 16:14:00 +0000,unfulfilled,EUR,2400.00,2026-04-13 16:14:00 +0000,1,Vessel VIII,2400.00,SKU,Anders Brand,Anders Brand,France,
#AA10623,bruno.jimenez@example.com,paid,2026-04-13 08:21:00 +0000,unfulfilled,EUR,2400.00,2026-04-13 08:21:00 +0000,1,Vessel VIII,2400.00,SKU,Bruno Jimenez,Bruno Jimenez,Germany,"vip,repeat-collector"
#AA10626,lukas.marchetti@example.com,paid,2026-04-14 09:28:00 +0000,unfulfilled,USD,2400.00,2026-04-14 09:28:00 +0000,1,Vessel VIII,2400.00,SKU,Lukas Marchetti,Lukas Marchetti,United States,
#AA10627,anders.moreau@example.com,paid,2026-04-14 10:35:00 +0000,unfulfilled,EUR,2400.00,2026-04-14 10:35:00 +0000,1,Vessel VIII,2400.00,SKU,Anders Moreau,Anders Moreau,Germany,repeat-collector
#AA10628,kai.sorensen@example.com,paid,2026-04-14 11:42:00 +0000,unfulfilled,USD,2400.00,2026-04-14 11:42:00 +0000,1,Vessel VIII,2400.00,SKU,Kai Sorensen,Kai Sorensen,Australia,"vip,repeat-collector"
#AA10631,aya.dubois@example.com,paid,2026-04-14 12:49:00 +0000,unfulfilled,EUR,2400.00,2026-04-14 12:49:00 +0000,1,Vessel VIII,2400.00,SKU,Aya Dubois,Aya Dubois,Netherlands,
#AA10632,sofia.petersen@example.com,paid,2026-04-14 13:56:00 +0000,unfulfilled,EUR,2400.00,2026-04-14 13:56:00 +0000,1,Vessel VIII,2400.00,SKU,Sofia Petersen,Sofia Petersen,Spain,
#AA10633,mia.bakker@example.com,paid,2026-04-14 14:03:00 +0000,unfulfilled,GBP,2400.00,2026-04-14 14:03:00 +0000,1,Vessel VIII,2400.00,SKU,Mia Bakker,Mia Bakker,United Kingdom,
#AA10634,rafael.diallo@example.com,paid,2026-04-14 15:10:00 +0000,unfulfilled,USD,2400.00,2026-04-14 15:10:00 +0000,1,Vessel VIII,2400.00,SKU,Rafael Diallo,Rafael Diallo,United States,
#AA10636,camille.gallagher@example.com,paid,2026-04-14 16:17:00 +0000,unfulfilled,GBP,2400.00,2026-04-14 16:17:00 +0000,1,Vessel VIII,2400.00,SKU,Camille Gallagher,Camille Gallagher,United Kingdom,first-order
#AA10639,arthur.costa@example.com,paid,2026-04-14 08:24:00 +0000,unfulfilled,USD,2400.00,2026-04-14 08:24:00 +0000,1,Vessel VIII,2400.00,SKU,Arthur Costa,Arthur Costa,Australia,repeat-collector
#AA10640,rafael.bakker@example.com,paid,2026-04-15 09:31:00 +0000,unfulfilled,EUR,2400.00,2026-04-15 09:31:00 +0000,1,Vessel VIII,2400.00,SKU,Rafael Bakker,Rafael Bakker,France,first-order
#AA10641,emil.bakker@example.com,paid,2026-04-15 10:38:00 +0000,unfulfilled,GBP,2400.00,2026-04-15 10:38:00 +0000,1,Vessel VIII,2400.00,SKU,Emil Bakker,Emil Bakker,United Kingdom,
#AA10643,leila.kowalska@example.com,paid,2026-04-15 11:45:00 +0000,unfulfilled,GBP,2400.00,2026-04-15 11:45:00 +0000,1,Vessel VIII,2400.00,SKU,Leila Kowalska,Leila Kowalska,United Kingdom,
#AA10646,theo.kowalska@example.com,paid,2026-04-15 12:52:00 +0000,unfulfilled,GBP,2400.00,2026-04-15 12:52:00 +0000,1,Vessel VIII,2400.00,SKU,Theo Kowalska,Theo Kowalska,United Kingdom,
#AA10647,priya.falk@example.com,paid,2026-04-15 13:59:00 +0000,unfulfilled,GBP,2400.00,2026-04-15 13:59:00 +0000,1,Vessel VIII,2400.00,SKU,Priya Falk,Priya Falk,United Kingdom,"vip,repeat-collector"
#AA10650,rune.sorensen@example.com,paid,2026-04-15 14:06:00 +0000,unfulfilled,GBP,2400.00,2026-04-15 14:06:00 +0000,1,Vessel VIII,2400.00,SKU,Rune Sorensen,Rune Sorensen,United Kingdom,vip
#AA10652,leila.tanaka@example.com,paid,2026-04-15 15:13:00 +0000,unfulfilled,EUR,2400.00,2026-04-15 15:13:00 +0000,1,Vessel VIII,2400.00,SKU,Leila Tanaka,Leila Tanaka,France,vip
#AA10654,mattia.diallo@example.com,paid,2026-04-15 16:20:00 +0000,unfulfilled,USD,2400.00,2026-04-15 16:20:00 +0000,1,Vessel VIII,2400.00,SKU,Mattia Diallo,Mattia Diallo,United States,
#AA10656,aleksander.silva@example.com,paid,2026-04-15 08:27:00 +0000,unfulfilled,USD,2400.00,2026-04-15 08:27:00 +0000,1,Vessel VIII,2400.00,SKU,Aleksander Silva,Aleksander Silva,United States,newsletter
#AA10657,stefan.silva@example.com,paid,2026-04-16 09:34:00 +0000,unfulfilled,EUR,2400.00,2026-04-16 09:34:00 +0000,1,Vessel VIII,2400.00,SKU,Stefan Silva,Stefan Silva,France,repeat-collector
#AA10658,ines.dunbar@example.com,paid,2026-04-16 10:41:00 +0000,unfulfilled,EUR,2400.00,2026-04-16 10:41:00 +0000,1,Vessel VIII,2400.00,SKU,Ines Dunbar,Ines Dunbar,Germany,
#AA10659,emil.hart@example.com,paid,2026-04-16 11:48:00 +0000,unfulfilled,EUR,2400.00,2026-04-16 11:48:00 +0000,1,Vessel VIII,2400.00,SKU,Emil Hart,Emil Hart,Netherlands,
#AA10660,aya.berger@example.com,paid,2026-04-16 12:55:00 +0000,unfulfilled,GBP,2400.00,2026-04-16 12:55:00 +0000,1,Vessel VIII,2400.00,SKU,Aya Berger,Aya Berger,United Kingdom,
#AA10663,anya.toft@example.com,paid,2026-04-16 13:02:00 +0000,unfulfilled,GBP,2400.00,2026-04-16 13:02:00 +0000,1,Vessel VIII,2400.00,SKU,Anya Toft,Anya Toft,United Kingdom,
#AA10664,ava.toft@example.com,paid,2026-04-16 14:09:00 +0000,unfulfilled,EUR,2400.00,2026-04-16 14:09:00 +0000,1,Vessel VIII,2400.00,SKU,Ava Toft,Ava Toft,France,
#AA10665,mia.diallo@example.com,paid,2026-04-16 15:16:00 +0000,unfulfilled,EUR,2400.00,2026-04-16 15:16:00 +0000,1,Vessel VIII,2400.00,SKU,Mia Diallo,Mia Diallo,Spain,
#AA10666,isla.oduya@example.com,paid,2026-04-16 16:23:00 +0000,unfulfilled,EUR,2400.00,2026-04-16 16:23:00 +0000,1,Vessel VIII,2400.00,SKU,Isla Oduya,Isla Oduya,Denmark,"vip,repeat-collector"
#AA10667,elena.costa@example.com,paid,2026-04-16 08:30:00 +0000,unfulfilled,GBP,2400.00,2026-04-16 08:30:00 +0000,1,Vessel VIII,2400.00,SKU,Elena Costa,Elena Costa,United Kingdom,
#AA10668,talia.adeyemi@example.com,paid,2026-04-17 09:37:00 +0000,unfulfilled,USD,2400.00,2026-04-17 09:37:00 +0000,1,Vessel VIII,2400.00,SKU,Talia Adeyemi,Talia Adeyemi,Canada,gift-order
#AA10670,bo.haugen@example.com,paid,2026-04-17 10:44:00 +0000,unfulfilled,USD,2400.00,2026-04-17 10:44:00 +0000,1,Vessel VIII,2400.00,SKU,Bo Haugen,Bo Haugen,United States,
#AA10671,signe.bakker@example.com,paid,2026-04-17 11:51:00 +0000,unfulfilled,EUR,2400.00,2026-04-17 11:51:00 +0000,1,Vessel VIII,2400.00,SKU,Signe Bakker,Signe Bakker,Germany,repeat-collector
#AA10672,mateo.duarte@example.com,paid,2026-04-17 12:58:00 +0000,unfulfilled,GBP,2400.00,2026-04-17 12:58:00 +0000,1,Vessel VIII,2400.00,SKU,Mateo Duarte,Mateo Duarte,United Kingdom,
#AA10673,noah.dunbar@example.com,paid,2026-04-17 13:05:00 +0000,unfulfilled,EUR,2400.00,2026-04-17 13:05:00 +0000,1,Vessel VIII,2400.00,SKU,Noah Dunbar,Noah Dunbar,France,
`;

export const BLUE_INTERVAL_CSV = `${HEADER}
#AA10301,eva.novak@example.com,paid,2026-01-15 09:00:00 +0000,fulfilled,GBP,320.00,2026-01-15 09:00:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Eva Novák,Eva Novák,United Kingdom,
#AA10302,george.baptiste@example.com,paid,2026-01-15 09:30:00 +0000,fulfilled,GBP,240.00,2026-01-15 09:30:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,George Baptiste,George Baptiste,United Kingdom,first-order
#AA10303,hana.suzuki@example.org,paid,2026-01-15 10:00:00 +0000,fulfilled,GBP,320.00,2026-01-15 10:00:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Hana Suzuki,Hana Suzuki,United Kingdom,"vip,framed-upgrade"
#AA10304,ivan.petrov@example.com,paid,2026-01-16 11:00:00 +0000,fulfilled,EUR,320.00,2026-01-16 11:00:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Ivan Petrov,Ivan Petrov,Poland,
#AA10305,julia.silva@example.com,paid,2026-01-16 12:00:00 +0000,fulfilled,EUR,240.00,2026-01-16 12:00:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Júlia Silva,Júlia Silva,Netherlands,repeat-collector
#AA10306,kwame.asante@example.com,paid,2026-01-17 13:00:00 +0000,fulfilled,GBP,320.00,2026-01-17 13:00:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Kwame Asante,Kwame Asante,United Kingdom,
#AA10701,sanne.sorensen@example.com,paid,2026-03-09 08:00:00 +0000,unfulfilled,GBP,460.00,2026-03-09 08:00:00 +0000,1,Blue Interval - Framed,460.00,SKU,Sanne Sorensen,Sanne Sorensen,United Kingdom,
#AA10704,bruno.oduya@example.com,paid,2026-03-09 09:07:00 +0000,unfulfilled,USD,460.00,2026-03-09 09:07:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Bruno Oduya,Bruno Oduya,United States,
#AA10706,greta.okafor@example.com,paid,2026-03-09 10:14:00 +0000,unfulfilled,EUR,460.00,2026-03-09 10:14:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Greta Okafor,Greta Okafor,Italy,
#AA10708,camille.vermeer@example.com,paid,2026-03-09 11:21:00 +0000,unfulfilled,EUR,460.00,2026-03-09 11:21:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Camille Vermeer,Camille Vermeer,Spain,
#AA10711,idris.andersen@example.com,paid,2026-03-09 12:28:00 +0000,unfulfilled,EUR,460.00,2026-03-09 12:28:00 +0000,1,Blue Interval - Framed,460.00,SKU,Idris Andersen,Idris Andersen,Germany,
#AA10713,greta.ngata@example.com,paid,2026-03-09 13:35:00 +0000,unfulfilled,GBP,460.00,2026-03-09 13:35:00 +0000,1,Blue Interval - Framed,460.00,SKU,Greta Ngata,Greta Ngata,United Kingdom,
#AA10714,rune.novak@example.com,paid,2026-03-09 14:42:00 +0000,unfulfilled,GBP,460.00,2026-03-09 14:42:00 +0000,1,Blue Interval - Framed,460.00,SKU,Rune Novak,Rune Novak,United Kingdom,gift-order
#AA10715,mia.aalto@example.com,paid,2026-03-09 15:49:00 +0000,unfulfilled,EUR,460.00,2026-03-09 15:49:00 +0000,1,Blue Interval - Framed,460.00,SKU,Mia Aalto,Mia Aalto,France,
#AA10718,mia.osei@example.com,paid,2026-03-09 16:56:00 +0000,unfulfilled,EUR,460.00,2026-03-09 16:56:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Mia Osei,Mia Osei,Netherlands,newsletter
#AA10719,bo.kaplan@example.com,paid,2026-03-09 08:03:00 +0000,unfulfilled,GBP,460.00,2026-03-09 08:03:00 +0000,1,Blue Interval - Framed,460.00,SKU,Bo Kaplan,Bo Kaplan,United Kingdom,
#AA10721,amelia.whitfield@example.com,paid,2026-03-10 09:10:00 +0000,unfulfilled,EUR,460.00,2026-03-10 09:10:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Amelia Whitfield,Amelia Whitfield,France,
#AA10722,nils.andersen@example.com,paid,2026-03-10 10:17:00 +0000,unfulfilled,EUR,460.00,2026-03-10 10:17:00 +0000,1,Blue Interval - Framed,460.00,SKU,Nils Andersen,Nils Andersen,Netherlands,
#AA10723,anders.grandi@example.com,paid,2026-03-10 11:24:00 +0000,unfulfilled,EUR,460.00,2026-03-10 11:24:00 +0000,1,Blue Interval - Framed,460.00,SKU,Anders Grandi,Anders Grandi,Poland,vip
#AA10724,lucia.larsen@example.com,paid,2026-03-10 12:31:00 +0000,unfulfilled,GBP,460.00,2026-03-10 12:31:00 +0000,1,Blue Interval - Framed,460.00,SKU,Lucia Larsen,Lucia Larsen,United Kingdom,
#AA10727,lucia.hassan@example.com,paid,2026-03-10 13:38:00 +0000,unfulfilled,GBP,460.00,2026-03-10 13:38:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Lucia Hassan,Lucia Hassan,United Kingdom,vip
#AA10728,ida.bakker@example.com,paid,2026-03-10 14:45:00 +0000,unfulfilled,USD,460.00,2026-03-10 14:45:00 +0000,1,Blue Interval - Framed,460.00,SKU,Ida Bakker,Ida Bakker,United States,vip
#AA10730,priya.grandi@example.com,paid,2026-03-10 15:52:00 +0000,unfulfilled,USD,460.00,2026-03-10 15:52:00 +0000,1,Blue Interval - Framed,460.00,SKU,Priya Grandi,Priya Grandi,United States,
#AA10732,mia.oduya@example.com,paid,2026-03-10 16:59:00 +0000,unfulfilled,GBP,460.00,2026-03-10 16:59:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Mia Oduya,Mia Oduya,United Kingdom,
#AA10734,roos.haugen@example.com,paid,2026-03-10 08:06:00 +0000,unfulfilled,EUR,460.00,2026-03-10 08:06:00 +0000,1,Blue Interval - Framed,460.00,SKU,Roos Haugen,Roos Haugen,Italy,
#AA10735,hana.larsen@example.com,paid,2026-03-11 09:13:00 +0000,unfulfilled,GBP,460.00,2026-03-11 09:13:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Hana Larsen,Hana Larsen,United Kingdom,gift-order
#AA10736,chiara.silva@example.com,paid,2026-03-11 10:20:00 +0000,unfulfilled,USD,460.00,2026-03-11 10:20:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Chiara Silva,Chiara Silva,United States,
#AA10739,noah.iversen@example.com,paid,2026-03-11 11:27:00 +0000,unfulfilled,EUR,460.00,2026-03-11 11:27:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Noah Iversen,Noah Iversen,Netherlands,
#AA10741,malik.moreau@example.com,paid,2026-03-11 12:34:00 +0000,unfulfilled,EUR,460.00,2026-03-11 12:34:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Malik Moreau,Malik Moreau,France,gift-order
#AA10743,anders.haugen@example.com,paid,2026-03-11 13:41:00 +0000,unfulfilled,USD,460.00,2026-03-11 13:41:00 +0000,1,Blue Interval - Framed,460.00,SKU,Anders Haugen,Anders Haugen,United States,vip
#AA10744,elena.petersen@example.com,paid,2026-03-11 14:48:00 +0000,unfulfilled,GBP,460.00,2026-03-11 14:48:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Elena Petersen,Elena Petersen,United Kingdom,
#AA10747,zara.grandi@example.com,paid,2026-03-11 15:55:00 +0000,unfulfilled,USD,460.00,2026-03-11 15:55:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Zara Grandi,Zara Grandi,Canada,
#AA10748,mia.moreau@example.com,paid,2026-03-11 16:02:00 +0000,unfulfilled,GBP,460.00,2026-03-11 16:02:00 +0000,1,Blue Interval - Framed,460.00,SKU,Mia Moreau,Mia Moreau,United Kingdom,repeat-collector
#AA10751,priya.nurmi@example.com,paid,2026-03-11 08:09:00 +0000,unfulfilled,EUR,460.00,2026-03-11 08:09:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Priya Nurmi,Priya Nurmi,Sweden,
#AA10753,henrik.brooks@example.com,paid,2026-03-12 09:16:00 +0000,unfulfilled,EUR,460.00,2026-03-12 09:16:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Henrik Brooks,Henrik Brooks,Spain,
#AA10756,casper.sorensen@example.com,paid,2026-03-12 10:23:00 +0000,unfulfilled,GBP,460.00,2026-03-12 10:23:00 +0000,1,Blue Interval - Framed,460.00,SKU,Casper Sorensen,Casper Sorensen,United Kingdom,
#AA10758,emil.tanaka@example.com,paid,2026-03-12 11:30:00 +0000,unfulfilled,EUR,460.00,2026-03-12 11:30:00 +0000,1,Blue Interval - Framed,460.00,SKU,Emil Tanaka,Emil Tanaka,France,
#AA10759,sofia.tanaka@example.com,paid,2026-03-12 12:37:00 +0000,unfulfilled,EUR,460.00,2026-03-12 12:37:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Sofia Tanaka,Sofia Tanaka,Sweden,
#AA10762,aleksander.nakamura@example.com,paid,2026-03-12 13:44:00 +0000,unfulfilled,USD,460.00,2026-03-12 13:44:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Aleksander Nakamura,Aleksander Nakamura,Australia,vip
#AA10765,felix.petersen@example.com,paid,2026-03-12 14:51:00 +0000,unfulfilled,EUR,460.00,2026-03-12 14:51:00 +0000,1,Blue Interval - Framed,460.00,SKU,Felix Petersen,Felix Petersen,France,
#AA10767,anders.bakker@example.com,paid,2026-03-12 15:58:00 +0000,unfulfilled,USD,460.00,2026-03-12 15:58:00 +0000,1,Blue Interval - Framed,460.00,SKU,Anders Bakker,Anders Bakker,Japan,
#AA10768,lena.berger@example.com,paid,2026-03-12 16:05:00 +0000,unfulfilled,EUR,460.00,2026-03-12 16:05:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Lena Berger,Lena Berger,France,
#AA10769,maya.delgado@example.com,paid,2026-03-12 08:12:00 +0000,unfulfilled,EUR,460.00,2026-03-12 08:12:00 +0000,1,Blue Interval - Framed,460.00,SKU,Maya Delgado,Maya Delgado,France,
#AA10770,viktor.dubois@example.com,paid,2026-03-13 09:19:00 +0000,unfulfilled,GBP,460.00,2026-03-13 09:19:00 +0000,1,Blue Interval - Framed,460.00,SKU,Viktor Dubois,Viktor Dubois,United Kingdom,
#AA10773,marta.osei@example.com,paid,2026-03-13 10:26:00 +0000,unfulfilled,EUR,460.00,2026-03-13 10:26:00 +0000,1,Blue Interval - Framed,460.00,SKU,Marta Osei,Marta Osei,Netherlands,
#AA10776,ava.costa@example.com,paid,2026-03-13 11:33:00 +0000,unfulfilled,GBP,460.00,2026-03-13 11:33:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Ava Costa,Ava Costa,United Kingdom,gift-order
#AA10777,yuki.aalto@example.com,paid,2026-03-13 12:40:00 +0000,unfulfilled,GBP,460.00,2026-03-13 12:40:00 +0000,1,Blue Interval - Framed,460.00,SKU,Yuki Aalto,Yuki Aalto,United Kingdom,
#AA10778,malik.sandberg@example.com,paid,2026-03-13 13:47:00 +0000,unfulfilled,EUR,460.00,2026-03-13 13:47:00 +0000,1,Blue Interval - Framed,460.00,SKU,Malik Sandberg,Malik Sandberg,Germany,
#AA10779,solveig.molnar@example.com,paid,2026-03-13 14:54:00 +0000,unfulfilled,USD,460.00,2026-03-13 14:54:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Solveig Molnar,Solveig Molnar,United States,gift-order
#AA10781,nils.grandi@example.com,paid,2026-03-13 15:01:00 +0000,unfulfilled,EUR,460.00,2026-03-13 15:01:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Nils Grandi,Nils Grandi,Italy,
#AA10782,ethan.adeyemi@example.com,paid,2026-03-13 16:08:00 +0000,unfulfilled,USD,460.00,2026-03-13 16:08:00 +0000,1,Blue Interval - Framed,460.00,SKU,Ethan Adeyemi,Ethan Adeyemi,United States,
#AA10783,idris.ngata@example.com,paid,2026-03-13 08:15:00 +0000,unfulfilled,EUR,460.00,2026-03-13 08:15:00 +0000,1,Blue Interval - Framed,460.00,SKU,Idris Ngata,Idris Ngata,Germany,
#AA10785,isla.moreau@example.com,paid,2026-03-14 09:22:00 +0000,unfulfilled,EUR,460.00,2026-03-14 09:22:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Isla Moreau,Isla Moreau,France,repeat-collector
#AA10788,marco.vermeer@example.com,paid,2026-03-14 10:29:00 +0000,unfulfilled,EUR,460.00,2026-03-14 10:29:00 +0000,1,Blue Interval - Framed,460.00,SKU,Marco Vermeer,Marco Vermeer,Spain,gift-order
#AA10789,anders.hart@example.com,paid,2026-03-14 11:36:00 +0000,unfulfilled,EUR,460.00,2026-03-14 11:36:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Anders Hart,Anders Hart,Netherlands,repeat-collector
#AA10791,ines.nurmi@example.com,paid,2026-03-14 12:43:00 +0000,unfulfilled,EUR,460.00,2026-03-14 12:43:00 +0000,1,Blue Interval - Framed,460.00,SKU,Ines Nurmi,Ines Nurmi,Spain,
#AA10792,roos.sorensen@example.com,paid,2026-03-14 13:50:00 +0000,unfulfilled,EUR,460.00,2026-03-14 13:50:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Roos Sorensen,Roos Sorensen,Denmark,
#AA10794,arthur.vermeer@example.com,paid,2026-03-14 14:57:00 +0000,unfulfilled,GBP,460.00,2026-03-14 14:57:00 +0000,1,Blue Interval - Framed,460.00,SKU,Arthur Vermeer,Arthur Vermeer,United Kingdom,
#AA10795,otto.larsen@example.com,paid,2026-03-14 15:04:00 +0000,unfulfilled,GBP,460.00,2026-03-14 15:04:00 +0000,1,Blue Interval - Framed,460.00,SKU,Otto Larsen,Otto Larsen,United Kingdom,
#AA10796,bram.hart@example.com,paid,2026-03-14 16:11:00 +0000,unfulfilled,EUR,460.00,2026-03-14 16:11:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Bram Hart,Bram Hart,Germany,"vip,repeat-collector"
#AA10798,felix.whitfield@example.com,paid,2026-03-14 08:18:00 +0000,unfulfilled,GBP,460.00,2026-03-14 08:18:00 +0000,1,Blue Interval - Framed,460.00,SKU,Felix Whitfield,Felix Whitfield,United Kingdom,gift-order
#AA10799,priya.sorensen@example.com,paid,2026-03-15 09:25:00 +0000,unfulfilled,USD,460.00,2026-03-15 09:25:00 +0000,1,Blue Interval - Framed,460.00,SKU,Priya Sorensen,Priya Sorensen,Japan,
#AA10800,nora.toft@example.com,paid,2026-03-15 10:32:00 +0000,unfulfilled,EUR,460.00,2026-03-15 10:32:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Nora Toft,Nora Toft,France,
#AA10801,maya.whitfield@example.com,paid,2026-03-15 11:39:00 +0000,unfulfilled,USD,460.00,2026-03-15 11:39:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Maya Whitfield,Maya Whitfield,United States,
#AA10802,jan.larsen@example.com,paid,2026-03-15 12:46:00 +0000,unfulfilled,EUR,460.00,2026-03-15 12:46:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Jan Larsen,Jan Larsen,Spain,
#AA10805,amara.haugen@example.com,paid,2026-03-15 13:53:00 +0000,unfulfilled,EUR,460.00,2026-03-15 13:53:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Amara Haugen,Amara Haugen,Sweden,vip
#AA10807,dmitri.keller@example.com,paid,2026-03-15 14:00:00 +0000,unfulfilled,GBP,460.00,2026-03-15 14:00:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Dmitri Keller,Dmitri Keller,United Kingdom,
#AA10810,clara.berger@example.com,paid,2026-03-15 15:07:00 +0000,unfulfilled,EUR,460.00,2026-03-15 15:07:00 +0000,1,Blue Interval - Framed,460.00,SKU,Clara Berger,Clara Berger,France,
#AA10811,dmitri.iversen@example.com,paid,2026-03-15 16:14:00 +0000,unfulfilled,USD,460.00,2026-03-15 16:14:00 +0000,1,Blue Interval - Framed,460.00,SKU,Dmitri Iversen,Dmitri Iversen,United States,
#AA10812,nadia.novak@example.com,paid,2026-03-15 08:21:00 +0000,unfulfilled,EUR,460.00,2026-03-15 08:21:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Nadia Novak,Nadia Novak,France,
#AA10813,petra.rasmussen@example.com,paid,2026-03-16 09:28:00 +0000,unfulfilled,GBP,460.00,2026-03-16 09:28:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Petra Rasmussen,Petra Rasmussen,United Kingdom,
#AA10814,zara.vermeer@example.com,paid,2026-03-16 10:35:00 +0000,unfulfilled,GBP,460.00,2026-03-16 10:35:00 +0000,1,Blue Interval - Framed,460.00,SKU,Zara Vermeer,Zara Vermeer,United Kingdom,
#AA10817,diego.delgado@example.com,paid,2026-03-16 11:42:00 +0000,unfulfilled,GBP,460.00,2026-03-16 11:42:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Diego Delgado,Diego Delgado,United Kingdom,
#AA10818,aya.grandi@example.com,paid,2026-03-16 12:49:00 +0000,unfulfilled,EUR,460.00,2026-03-16 12:49:00 +0000,1,Blue Interval - Framed,460.00,SKU,Aya Grandi,Aya Grandi,Denmark,
#AA10821,emil.halvorsen@example.com,paid,2026-03-16 13:56:00 +0000,unfulfilled,GBP,460.00,2026-03-16 13:56:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Emil Halvorsen,Emil Halvorsen,United Kingdom,repeat-collector
#AA10822,solveig.osei@example.com,paid,2026-03-16 14:03:00 +0000,unfulfilled,USD,460.00,2026-03-16 14:03:00 +0000,1,Blue Interval - Framed,460.00,SKU,Solveig Osei,Solveig Osei,United States,
#AA10823,aleksander.aalto@example.com,paid,2026-03-16 15:10:00 +0000,unfulfilled,EUR,460.00,2026-03-16 15:10:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Aleksander Aalto,Aleksander Aalto,France,gift-order
#AA10824,jonas.okonkwo@example.com,paid,2026-03-16 16:17:00 +0000,unfulfilled,USD,460.00,2026-03-16 16:17:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Jonas Okonkwo,Jonas Okonkwo,United States,
#AA10827,ava.andersen@example.com,paid,2026-03-16 08:24:00 +0000,unfulfilled,GBP,460.00,2026-03-16 08:24:00 +0000,1,Blue Interval - Framed,460.00,SKU,Ava Andersen,Ava Andersen,United Kingdom,
#AA10829,amara.dubois@example.com,paid,2026-03-17 09:31:00 +0000,unfulfilled,GBP,460.00,2026-03-17 09:31:00 +0000,1,Blue Interval - Unframed,460.00,SKU,Amara Dubois,Amara Dubois,United Kingdom,

#AA10830,ingrid.ostrowski@example.com,paid,2026-01-17 09:00:00 +0000,fulfilled,EUR,240.00,2026-01-17 09:00:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Ingrid Ostrowski,Ingrid Ostrowski,Poland,first-order
#AA10831,greta.halvorsen@example.com,paid,2026-01-17 10:11:00 +0000,fulfilled,EUR,320.00,2026-01-17 10:11:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Greta Halvorsen,Greta Halvorsen,Germany,first-order
#AA10832,katja.zetterberg@example.com,paid,2026-01-17 11:22:00 +0000,fulfilled,EUR,320.00,2026-01-17 11:22:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Katja Zetterberg,Katja Zetterberg,Austria,
#AA10833,paloma.rousseau@example.com,paid,2026-01-17 12:33:00 +0000,fulfilled,EUR,320.00,2026-01-17 12:33:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Paloma Rousseau,Paloma Rousseau,Spain,first-order
#AA10834,zofia.vasquez@example.com,paid,2026-01-18 13:44:00 +0000,fulfilled,USD,240.00,2026-01-18 13:44:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Zofia Vasquez,Zofia Vasquez,Canada,first-order
#AA10835,ingrid.halvorsen@example.com,paid,2026-01-18 14:55:00 +0000,fulfilled,EUR,240.00,2026-01-18 14:55:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Ingrid Halvorsen,Ingrid Halvorsen,Belgium,first-order
#AA10836,eamon.dahlberg@example.com,paid,2026-01-18 15:06:00 +0000,fulfilled,EUR,320.00,2026-01-18 15:06:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Eamon Dahlberg,Eamon Dahlberg,Ireland,
#AA10837,jolanta.corsten@example.com,paid,2026-01-19 16:17:00 +0000,fulfilled,EUR,240.00,2026-01-19 16:17:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Jolanta Corsten,Jolanta Corsten,Ireland,first-order
#AA10838,rasmus.wexler@example.com,paid,2026-01-19 09:28:00 +0000,fulfilled,EUR,320.00,2026-01-19 09:28:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Rasmus Wexler,Rasmus Wexler,Netherlands,first-order
#AA10839,delphine.ostrowski@example.com,paid,2026-01-19 10:39:00 +0000,fulfilled,EUR,240.00,2026-01-19 10:39:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Delphine Ostrowski,Delphine Ostrowski,France,repeat-collector
#AA10840,ingrid.engel@example.com,paid,2026-01-20 11:50:00 +0000,fulfilled,USD,240.00,2026-01-20 11:50:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Ingrid Engel,Ingrid Engel,Australia,
#AA10841,farid.zetterberg@example.com,paid,2026-01-20 12:01:00 +0000,fulfilled,EUR,240.00,2026-01-20 12:01:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Farid Zetterberg,Farid Zetterberg,Denmark,repeat-collector
#AA10842,thijs.halvorsen@example.com,paid,2026-01-20 13:12:00 +0000,fulfilled,EUR,240.00,2026-01-20 13:12:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Thijs Halvorsen,Thijs Halvorsen,Poland,
#AA10843,otto.abramsen@example.com,paid,2026-01-21 14:23:00 +0000,fulfilled,EUR,240.00,2026-01-21 14:23:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Otto Abramsen,Otto Abramsen,Norway,
#AA10844,renate.sandoval@example.com,paid,2026-01-21 15:34:00 +0000,fulfilled,EUR,320.00,2026-01-21 15:34:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Renate Sandoval,Renate Sandoval,France,
#AA10845,beatriz.bianchi@example.com,paid,2026-01-21 16:45:00 +0000,fulfilled,EUR,240.00,2026-01-21 16:45:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Beatriz Bianchi,Beatriz Bianchi,Austria,first-order
#AA10846,noor.bergstrom@example.com,paid,2026-01-22 09:56:00 +0000,fulfilled,USD,240.00,2026-01-22 09:56:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Noor Bergstrom,Noor Bergstrom,Australia,
#AA10847,vera.quist@example.com,paid,2026-01-22 10:07:00 +0000,fulfilled,EUR,240.00,2026-01-22 10:07:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Vera Quist,Vera Quist,Spain,first-order
#AA10848,nikolai.quist@example.com,paid,2026-01-22 11:18:00 +0000,fulfilled,EUR,240.00,2026-01-22 11:18:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Nikolai Quist,Nikolai Quist,Denmark,repeat-collector
#AA10849,kasper.bianchi@example.com,paid,2026-01-22 12:29:00 +0000,fulfilled,EUR,240.00,2026-01-22 12:29:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Kasper Bianchi,Kasper Bianchi,Netherlands,first-order
#AA10850,tove.ylonen@example.com,paid,2026-01-23 13:40:00 +0000,fulfilled,EUR,320.00,2026-01-23 13:40:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Tove Ylonen,Tove Ylonen,Portugal,
#AA10851,corentin.sandoval@example.com,paid,2026-01-23 14:51:00 +0000,fulfilled,EUR,320.00,2026-01-23 14:51:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Corentin Sandoval,Corentin Sandoval,Sweden,first-order
#AA10852,jolanta.wexler@example.com,paid,2026-01-23 15:02:00 +0000,fulfilled,EUR,320.00,2026-01-23 15:02:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Jolanta Wexler,Jolanta Wexler,Netherlands,first-order
#AA10853,gustav.rousseau@example.com,paid,2026-01-24 16:13:00 +0000,fulfilled,EUR,320.00,2026-01-24 16:13:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Gustav Rousseau,Gustav Rousseau,Ireland,
#AA10854,yannick.dupont@example.com,paid,2026-01-24 09:24:00 +0000,fulfilled,EUR,240.00,2026-01-24 09:24:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Yannick Dupont,Yannick Dupont,Denmark,
#AA10855,wiktor.paquet@example.com,paid,2026-01-24 10:35:00 +0000,fulfilled,USD,320.00,2026-01-24 10:35:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Wiktor Paquet,Wiktor Paquet,United States,
#AA10856,paloma.dupont@example.com,paid,2026-01-25 11:46:00 +0000,fulfilled,GBP,240.00,2026-01-25 11:46:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Paloma Dupont,Paloma Dupont,United Kingdom,first-order
#AA10857,greta.bergstrom@example.com,paid,2026-01-25 12:57:00 +0000,fulfilled,EUR,240.00,2026-01-25 12:57:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Greta Bergstrom,Greta Bergstrom,Belgium,
#AA10858,ulla.vasquez@example.com,paid,2026-01-25 13:08:00 +0000,fulfilled,EUR,240.00,2026-01-25 13:08:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Ulla Vasquez,Ulla Vasquez,Norway,first-order
#AA10859,lorenzo.ylonen@example.com,paid,2026-01-26 14:19:00 +0000,fulfilled,USD,240.00,2026-01-26 14:19:00 +0000,1,Blue Interval - Unframed,240.00,BI-UF,Lorenzo Ylonen,Lorenzo Ylonen,Japan,repeat-collector
#AA10860,kasper.nyberg@example.com,paid,2026-01-26 15:30:00 +0000,fulfilled,EUR,320.00,2026-01-26 15:30:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Kasper Nyberg,Kasper Nyberg,Germany,repeat-collector
#AA10861,umberto.eriksen@example.com,paid,2026-01-26 16:41:00 +0000,fulfilled,EUR,320.00,2026-01-26 16:41:00 +0000,1,Blue Interval - Framed,320.00,BI-FR,Umberto Eriksen,Umberto Eriksen,France,`;

export const NIGHT_GARDEN_CSV = `${HEADER}
#AA10601,olive.fitzgerald@example.com,paid,2026-08-20 09:12:00 +0100,unfulfilled,GBP,460.00,2026-08-20 09:12:00 +0100,1,Night Garden - Framed,460.00,NG-FR,Olive Fitzgerald,Olive Fitzgerald,United Kingdom,vip
#AA10602,ravi.sharma@example.com,paid,2026-08-20 09:45:00 +0100,unfulfilled,GBP,340.00,2026-08-20 09:45:00 +0100,1,Night Garden - Unframed,340.00,NG-UF,Ravi Sharma,Ravi Sharma,United Kingdom,repeat-collector
#AA10603,,paid,2026-08-20 10:15:00 +0100,unfulfilled,GBP,460.00,2026-08-20 10:15:00 +0100,1,Night Garden - Framed,460.00,NG-FR,Beatriz Almeida,Beatriz Almeida,United Kingdom,
#AA10604,charles.whitmore@example.net,paid,2026-08-20 11:00:00 +0100,unfulfilled,GBP,340.00,2026-08-20 11:00:00 +0100,1,Night Garden - Unframed,340.00,NG-UF,Charles Whitmore,Charles Whitmore,United Kingdom,first-order
#AA10605,dina.khoury@example.com,paid,2026-08-21 08:30:00 +0100,unfulfilled,EUR,460.00,2026-08-21 08:30:00 +0100,1,Night Garden - Framed,460.00,NG-FR,Dina Khoury,Dina Khoury,France,"vip,framed-upgrade"
#AA10605,dina.khoury@example.com,paid,2026-08-21 08:30:00 +0100,unfulfilled,EUR,460.00,2026-08-21 08:30:00 +0100,1,Night Garden - Framed,460.00,NG-FR,Dina Khoury,Dina Khoury,Germany,
#AA10606,emil.johansson@example.com,paid,2026-08-21 09:50:00 +0100,unfulfilled,EUR,340.00,2026-08-21 09:50:00 +0100,1,Night Garden - Unframed,340.00,NG-UF,Emil Johansson,Emil Johansson,Italy,repeat-collector
#AA10607,fatima.zahra@example.org,paid,2026-08-22 10:20:00 +0100,unfulfilled,GBP,460.00,2026-08-22 10:20:00 +0100,1,Night Garden - Framed,460.00,NG-FR,"Zahra, Fatima","Zahra, Fatima",United Kingdom,
#AA10801,zara.ngata@example.com,paid,2026-04-17 08:00:00 +0000,unfulfilled,GBP,620.00,2026-04-17 08:00:00 +0000,1,Night Garden - Unframed,620.00,SKU,Zara Ngata,Zara Ngata,United Kingdom,"vip,repeat-collector"
#AA10803,hana.falk@example.com,paid,2026-04-17 09:07:00 +0000,unfulfilled,EUR,620.00,2026-04-17 09:07:00 +0000,1,Night Garden - Framed,620.00,SKU,Hana Falk,Hana Falk,Netherlands,
#AA10805,amelia.kaplan@example.com,paid,2026-04-17 10:14:00 +0000,unfulfilled,EUR,620.00,2026-04-17 10:14:00 +0000,1,Night Garden - Framed,620.00,SKU,Amelia Kaplan,Amelia Kaplan,Denmark,
#AA10806,bruno.petersen@example.com,paid,2026-04-17 11:21:00 +0000,unfulfilled,EUR,620.00,2026-04-17 11:21:00 +0000,1,Night Garden - Framed,620.00,SKU,Bruno Petersen,Bruno Petersen,Netherlands,
#AA10809,amelia.iversen@example.com,paid,2026-04-17 12:28:00 +0000,unfulfilled,EUR,620.00,2026-04-17 12:28:00 +0000,1,Night Garden - Framed,620.00,SKU,Amelia Iversen,Amelia Iversen,Denmark,
#AA10811,elena.jimenez@example.com,paid,2026-04-17 13:35:00 +0000,unfulfilled,USD,620.00,2026-04-17 13:35:00 +0000,1,Night Garden - Unframed,620.00,SKU,Elena Jimenez,Elena Jimenez,United States,
#AA10813,malik.marchetti@example.com,paid,2026-04-17 14:42:00 +0000,unfulfilled,EUR,620.00,2026-04-17 14:42:00 +0000,1,Night Garden - Unframed,620.00,SKU,Malik Marchetti,Malik Marchetti,Denmark,first-order
#AA10815,theo.sandberg@example.com,paid,2026-04-17 15:49:00 +0000,unfulfilled,EUR,620.00,2026-04-17 15:49:00 +0000,1,Night Garden - Framed,620.00,SKU,Theo Sandberg,Theo Sandberg,Germany,
#AA10816,aya.petersen@example.com,paid,2026-04-17 16:56:00 +0000,unfulfilled,USD,620.00,2026-04-17 16:56:00 +0000,1,Night Garden - Unframed,620.00,SKU,Aya Petersen,Aya Petersen,Canada,newsletter
#AA10817,talia.grandi@example.com,paid,2026-04-17 08:03:00 +0000,unfulfilled,EUR,620.00,2026-04-17 08:03:00 +0000,1,Night Garden - Framed,620.00,SKU,Talia Grandi,Talia Grandi,Spain,
#AA10818,henrik.mensah@example.com,paid,2026-04-18 09:10:00 +0000,unfulfilled,EUR,620.00,2026-04-18 09:10:00 +0000,1,Night Garden - Framed,620.00,SKU,Henrik Mensah,Henrik Mensah,Netherlands,repeat-collector
#AA10820,dmitri.weber@example.com,paid,2026-04-18 10:17:00 +0000,unfulfilled,EUR,620.00,2026-04-18 10:17:00 +0000,1,Night Garden - Unframed,620.00,SKU,Dmitri Weber,Dmitri Weber,Netherlands,
#AA10822,marta.diallo@example.com,paid,2026-04-18 11:24:00 +0000,unfulfilled,EUR,620.00,2026-04-18 11:24:00 +0000,1,Night Garden - Unframed,620.00,SKU,Marta Diallo,Marta Diallo,Germany,
#AA10824,bruno.haugen@example.com,paid,2026-04-18 12:31:00 +0000,unfulfilled,GBP,620.00,2026-04-18 12:31:00 +0000,1,Night Garden - Framed,620.00,SKU,Bruno Haugen,Bruno Haugen,United Kingdom,
#AA10827,zara.mensah@example.com,paid,2026-04-18 13:38:00 +0000,unfulfilled,EUR,620.00,2026-04-18 13:38:00 +0000,1,Night Garden - Framed,620.00,SKU,Zara Mensah,Zara Mensah,France,
#AA10828,rafael.kowalska@example.com,paid,2026-04-18 14:45:00 +0000,unfulfilled,EUR,620.00,2026-04-18 14:45:00 +0000,1,Night Garden - Framed,620.00,SKU,Rafael Kowalska,Rafael Kowalska,Netherlands,
#AA10829,sofia.nakamura@example.com,paid,2026-04-18 15:52:00 +0000,unfulfilled,GBP,620.00,2026-04-18 15:52:00 +0000,1,Night Garden - Framed,620.00,SKU,Sofia Nakamura,Sofia Nakamura,United Kingdom,repeat-collector
#AA10830,anders.hoffmann@example.com,paid,2026-04-18 16:59:00 +0000,unfulfilled,USD,620.00,2026-04-18 16:59:00 +0000,1,Night Garden - Framed,620.00,SKU,Anders Hoffmann,Anders Hoffmann,Japan,
#AA10831,sofia.diallo@example.com,paid,2026-04-18 08:06:00 +0000,unfulfilled,EUR,620.00,2026-04-18 08:06:00 +0000,1,Night Garden - Framed,620.00,SKU,Sofia Diallo,Sofia Diallo,Spain,
#AA10832,nils.kowalska@example.com,paid,2026-04-19 09:13:00 +0000,unfulfilled,USD,620.00,2026-04-19 09:13:00 +0000,1,Night Garden - Framed,620.00,SKU,Nils Kowalska,Nils Kowalska,United States,repeat-collector
#AA10835,roos.acheampong@example.com,paid,2026-04-19 10:20:00 +0000,unfulfilled,EUR,620.00,2026-04-19 10:20:00 +0000,1,Night Garden - Framed,620.00,SKU,Roos Acheampong,Roos Acheampong,Germany,
#AA10836,stefan.mensah@example.com,paid,2026-04-19 11:27:00 +0000,unfulfilled,EUR,620.00,2026-04-19 11:27:00 +0000,1,Night Garden - Unframed,620.00,SKU,Stefan Mensah,Stefan Mensah,Netherlands,
#AA10839,leila.costa@example.com,paid,2026-04-19 12:34:00 +0000,unfulfilled,GBP,620.00,2026-04-19 12:34:00 +0000,1,Night Garden - Unframed,620.00,SKU,Leila Costa,Leila Costa,United Kingdom,
#AA10842,malik.costa@example.com,paid,2026-04-19 13:41:00 +0000,unfulfilled,EUR,620.00,2026-04-19 13:41:00 +0000,1,Night Garden - Framed,620.00,SKU,Malik Costa,Malik Costa,Netherlands,
#AA10845,nora.rossi@example.com,paid,2026-04-19 14:48:00 +0000,unfulfilled,EUR,620.00,2026-04-19 14:48:00 +0000,1,Night Garden - Unframed,620.00,SKU,Nora Rossi,Nora Rossi,France,gift-order
#AA10847,ines.novak@example.com,paid,2026-04-19 15:55:00 +0000,unfulfilled,GBP,620.00,2026-04-19 15:55:00 +0000,1,Night Garden - Framed,620.00,SKU,Ines Novak,Ines Novak,United Kingdom,
#AA10848,maya.molnar@example.com,paid,2026-04-19 16:02:00 +0000,unfulfilled,EUR,620.00,2026-04-19 16:02:00 +0000,1,Night Garden - Unframed,620.00,SKU,Maya Molnar,Maya Molnar,Netherlands,vip
#AA10850,olivia.novak@example.com,paid,2026-04-19 08:09:00 +0000,unfulfilled,USD,620.00,2026-04-19 08:09:00 +0000,1,Night Garden - Unframed,620.00,SKU,Olivia Novak,Olivia Novak,United States,
#AA10853,aleksander.hart@example.com,paid,2026-04-20 09:16:00 +0000,unfulfilled,EUR,620.00,2026-04-20 09:16:00 +0000,1,Night Garden - Unframed,620.00,SKU,Aleksander Hart,Aleksander Hart,France,repeat-collector
#AA10856,rafael.falk@example.com,paid,2026-04-20 10:23:00 +0000,unfulfilled,EUR,620.00,2026-04-20 10:23:00 +0000,1,Night Garden - Unframed,620.00,SKU,Rafael Falk,Rafael Falk,France,"vip,repeat-collector"
#AA10858,mattia.falk@example.com,paid,2026-04-20 11:30:00 +0000,unfulfilled,EUR,620.00,2026-04-20 11:30:00 +0000,1,Night Garden - Unframed,620.00,SKU,Mattia Falk,Mattia Falk,Germany,newsletter
#AA10860,nils.weber@example.com,paid,2026-04-20 12:37:00 +0000,unfulfilled,GBP,620.00,2026-04-20 12:37:00 +0000,1,Night Garden - Framed,620.00,SKU,Nils Weber,Nils Weber,United Kingdom,gift-order
#AA10862,jan.acheampong@example.com,paid,2026-04-20 13:44:00 +0000,unfulfilled,EUR,620.00,2026-04-20 13:44:00 +0000,1,Night Garden - Unframed,620.00,SKU,Jan Acheampong,Jan Acheampong,Poland,repeat-collector
#AA10863,henrik.ferreira@example.com,paid,2026-04-20 14:51:00 +0000,unfulfilled,EUR,620.00,2026-04-20 14:51:00 +0000,1,Night Garden - Unframed,620.00,SKU,Henrik Ferreira,Henrik Ferreira,Netherlands,gift-order
#AA10864,sven.marchetti@example.com,paid,2026-04-20 15:58:00 +0000,unfulfilled,GBP,620.00,2026-04-20 15:58:00 +0000,1,Night Garden - Unframed,620.00,SKU,Sven Marchetti,Sven Marchetti,United Kingdom,
#AA10865,aya.hart@example.com,paid,2026-04-20 16:05:00 +0000,unfulfilled,USD,620.00,2026-04-20 16:05:00 +0000,1,Night Garden - Framed,620.00,SKU,Aya Hart,Aya Hart,United States,"vip,repeat-collector"
#AA10868,casper.nurmi@example.com,paid,2026-04-20 08:12:00 +0000,unfulfilled,USD,620.00,2026-04-20 08:12:00 +0000,1,Night Garden - Unframed,620.00,SKU,Casper Nurmi,Casper Nurmi,United States,vip
#AA10871,lukas.weber@example.com,paid,2026-04-21 09:19:00 +0000,unfulfilled,EUR,620.00,2026-04-21 09:19:00 +0000,1,Night Garden - Framed,620.00,SKU,Lukas Weber,Lukas Weber,France,
#AA10874,ethan.jimenez@example.com,paid,2026-04-21 10:26:00 +0000,unfulfilled,EUR,620.00,2026-04-21 10:26:00 +0000,1,Night Garden - Unframed,620.00,SKU,Ethan Jimenez,Ethan Jimenez,Germany,first-order
#AA10877,anouk.andersen@example.com,paid,2026-04-21 11:33:00 +0000,unfulfilled,USD,620.00,2026-04-21 11:33:00 +0000,1,Night Garden - Unframed,620.00,SKU,Anouk Andersen,Anouk Andersen,United States,
#AA10879,greta.falk@example.com,paid,2026-04-21 12:40:00 +0000,unfulfilled,USD,620.00,2026-04-21 12:40:00 +0000,1,Night Garden - Unframed,620.00,SKU,Greta Falk,Greta Falk,United States,"vip,repeat-collector"
#AA10881,leila.aalto@example.com,paid,2026-04-21 13:47:00 +0000,unfulfilled,GBP,620.00,2026-04-21 13:47:00 +0000,1,Night Garden - Framed,620.00,SKU,Leila Aalto,Leila Aalto,United Kingdom,vip
#AA10882,aya.halvorsen@example.com,paid,2026-04-21 14:54:00 +0000,unfulfilled,EUR,620.00,2026-04-21 14:54:00 +0000,1,Night Garden - Framed,620.00,SKU,Aya Halvorsen,Aya Halvorsen,Germany,
#AA10883,rune.whitfield@example.com,paid,2026-04-21 15:01:00 +0000,unfulfilled,EUR,620.00,2026-04-21 15:01:00 +0000,1,Night Garden - Unframed,620.00,SKU,Rune Whitfield,Rune Whitfield,Italy,
#AA10884,ethan.acheampong@example.com,paid,2026-04-21 16:08:00 +0000,unfulfilled,EUR,620.00,2026-04-21 16:08:00 +0000,1,Night Garden - Framed,620.00,SKU,Ethan Acheampong,Ethan Acheampong,Germany,
#AA10886,casper.tanaka@example.com,paid,2026-04-21 08:15:00 +0000,unfulfilled,GBP,620.00,2026-04-21 08:15:00 +0000,1,Night Garden - Unframed,620.00,SKU,Casper Tanaka,Casper Tanaka,United Kingdom,
#AA10887,ava.hassan@example.com,paid,2026-04-22 09:22:00 +0000,unfulfilled,USD,620.00,2026-04-22 09:22:00 +0000,1,Night Garden - Unframed,620.00,SKU,Ava Hassan,Ava Hassan,United States,
#AA10888,freya.silva@example.com,paid,2026-04-22 10:29:00 +0000,unfulfilled,GBP,620.00,2026-04-22 10:29:00 +0000,1,Night Garden - Framed,620.00,SKU,Freya Silva,Freya Silva,United Kingdom,vip
#AA10890,elena.aalto@example.com,paid,2026-04-22 11:36:00 +0000,unfulfilled,EUR,620.00,2026-04-22 11:36:00 +0000,1,Night Garden - Unframed,620.00,SKU,Elena Aalto,Elena Aalto,Poland,
#AA10891,mia.costa@example.com,paid,2026-04-22 12:43:00 +0000,unfulfilled,EUR,620.00,2026-04-22 12:43:00 +0000,1,Night Garden - Framed,620.00,SKU,Mia Costa,Mia Costa,Netherlands,"vip,repeat-collector"
#AA10893,rune.rasmussen@example.com,paid,2026-04-22 13:50:00 +0000,unfulfilled,EUR,620.00,2026-04-22 13:50:00 +0000,1,Night Garden - Unframed,620.00,SKU,Rune Rasmussen,Rune Rasmussen,Spain,
#AA10896,chiara.jimenez@example.com,paid,2026-04-22 14:57:00 +0000,unfulfilled,EUR,620.00,2026-04-22 14:57:00 +0000,1,Night Garden - Framed,620.00,SKU,Chiara Jimenez,Chiara Jimenez,Spain,
#AA10899,anouk.dubois@example.com,paid,2026-04-22 15:04:00 +0000,unfulfilled,GBP,620.00,2026-04-22 15:04:00 +0000,1,Night Garden - Framed,620.00,SKU,Anouk Dubois,Anouk Dubois,United Kingdom,gift-order
#AA10901,pierre.sandberg@example.com,paid,2026-04-22 16:11:00 +0000,unfulfilled,GBP,620.00,2026-04-22 16:11:00 +0000,1,Night Garden - Unframed,620.00,SKU,Pierre Sandberg,Pierre Sandberg,United Kingdom,
#AA10902,talia.delgado@example.com,paid,2026-04-22 08:18:00 +0000,unfulfilled,EUR,620.00,2026-04-22 08:18:00 +0000,1,Night Garden - Framed,620.00,SKU,Talia Delgado,Talia Delgado,Netherlands,gift-order
#AA10903,anders.keller@example.com,paid,2026-04-23 09:25:00 +0000,unfulfilled,EUR,620.00,2026-04-23 09:25:00 +0000,1,Night Garden - Unframed,620.00,SKU,Anders Keller,Anders Keller,Netherlands,vip
#AA10905,greta.lange@example.com,paid,2026-04-23 10:32:00 +0000,unfulfilled,USD,620.00,2026-04-23 10:32:00 +0000,1,Night Garden - Framed,620.00,SKU,Greta Lange,Greta Lange,United States,
#AA10908,ethan.mensah@example.com,paid,2026-04-23 11:39:00 +0000,unfulfilled,EUR,620.00,2026-04-23 11:39:00 +0000,1,Night Garden - Framed,620.00,SKU,Ethan Mensah,Ethan Mensah,Netherlands,
#AA10910,aleksander.adeyemi@example.com,paid,2026-04-23 12:46:00 +0000,unfulfilled,GBP,620.00,2026-04-23 12:46:00 +0000,1,Night Garden - Unframed,620.00,SKU,Aleksander Adeyemi,Aleksander Adeyemi,United Kingdom,repeat-collector
#AA10911,rafael.tanaka@example.com,paid,2026-04-23 13:53:00 +0000,unfulfilled,GBP,620.00,2026-04-23 13:53:00 +0000,1,Night Garden - Framed,620.00,SKU,Rafael Tanaka,Rafael Tanaka,United Kingdom,
#AA10914,rune.ferreira@example.com,paid,2026-04-23 14:00:00 +0000,unfulfilled,GBP,620.00,2026-04-23 14:00:00 +0000,1,Night Garden - Framed,620.00,SKU,Rune Ferreira,Rune Ferreira,United Kingdom,
#AA10915,roos.aalto@example.com,paid,2026-04-23 15:07:00 +0000,unfulfilled,EUR,620.00,2026-04-23 15:07:00 +0000,1,Night Garden - Framed,620.00,SKU,Roos Aalto,Roos Aalto,Germany,vip
#AA10918,hugo.dunbar@example.com,paid,2026-04-23 16:14:00 +0000,unfulfilled,EUR,620.00,2026-04-23 16:14:00 +0000,1,Night Garden - Framed,620.00,SKU,Hugo Dunbar,Hugo Dunbar,Denmark,gift-order
#AA10921,solveig.rivera@example.com,paid,2026-04-23 08:21:00 +0000,unfulfilled,EUR,620.00,2026-04-23 08:21:00 +0000,1,Night Garden - Unframed,620.00,SKU,Solveig Rivera,Solveig Rivera,Netherlands,first-order
#AA10923,anouk.toft@example.com,paid,2026-04-24 09:28:00 +0000,unfulfilled,EUR,620.00,2026-04-24 09:28:00 +0000,1,Night Garden - Framed,620.00,SKU,Anouk Toft,Anouk Toft,Italy,gift-order
#AA10924,viktor.keller@example.com,paid,2026-04-24 10:35:00 +0000,unfulfilled,GBP,620.00,2026-04-24 10:35:00 +0000,1,Night Garden - Framed,620.00,SKU,Viktor Keller,Viktor Keller,United Kingdom,
#AA10927,tomas.oduya@example.com,paid,2026-04-24 11:42:00 +0000,unfulfilled,EUR,620.00,2026-04-24 11:42:00 +0000,1,Night Garden - Unframed,620.00,SKU,Tomas Oduya,Tomas Oduya,Spain,
#AA10930,maya.iversen@example.com,paid,2026-04-24 12:49:00 +0000,unfulfilled,USD,620.00,2026-04-24 12:49:00 +0000,1,Night Garden - Framed,620.00,SKU,Maya Iversen,Maya Iversen,United States,
#AA10931,marta.kowalska@example.com,paid,2026-04-24 13:56:00 +0000,unfulfilled,GBP,620.00,2026-04-24 13:56:00 +0000,1,Night Garden - Unframed,620.00,SKU,Marta Kowalska,Marta Kowalska,United Kingdom,
#AA10933,zara.rossi@example.com,paid,2026-04-24 14:03:00 +0000,unfulfilled,GBP,620.00,2026-04-24 14:03:00 +0000,1,Night Garden - Unframed,620.00,SKU,Zara Rossi,Zara Rossi,United Kingdom,first-order
#AA10934,maya.lindgren@example.com,paid,2026-04-24 15:10:00 +0000,unfulfilled,EUR,620.00,2026-04-24 15:10:00 +0000,1,Night Garden - Framed,620.00,SKU,Maya Lindgren,Maya Lindgren,Netherlands,vip
#AA10937,elena.novak@example.com,paid,2026-04-24 16:17:00 +0000,unfulfilled,EUR,620.00,2026-04-24 16:17:00 +0000,1,Night Garden - Unframed,620.00,SKU,Elena Novak,Elena Novak,Poland,
#AA10938,liam.dubois@example.com,paid,2026-04-24 08:24:00 +0000,unfulfilled,EUR,620.00,2026-04-24 08:24:00 +0000,1,Night Garden - Framed,620.00,SKU,Liam Dubois,Liam Dubois,Netherlands,
#AA10941,bo.whitfield@example.com,paid,2026-04-25 09:31:00 +0000,unfulfilled,USD,620.00,2026-04-25 09:31:00 +0000,1,Night Garden - Unframed,620.00,SKU,Bo Whitfield,Bo Whitfield,United States,
#AA10943,rune.falk@example.com,paid,2026-04-25 10:38:00 +0000,unfulfilled,USD,620.00,2026-04-25 10:38:00 +0000,1,Night Garden - Unframed,620.00,SKU,Rune Falk,Rune Falk,Japan,"vip,repeat-collector"
#AA10946,anouk.bakker@example.com,paid,2026-04-25 11:45:00 +0000,unfulfilled,USD,620.00,2026-04-25 11:45:00 +0000,1,Night Garden - Framed,620.00,SKU,Anouk Bakker,Anouk Bakker,Australia,repeat-collector
#AA10949,mateo.rivera@example.com,paid,2026-04-25 12:52:00 +0000,unfulfilled,GBP,620.00,2026-04-25 12:52:00 +0000,1,Night Garden - Framed,620.00,SKU,Mateo Rivera,Mateo Rivera,United Kingdom,
#AA10952,alice.novak@example.com,paid,2026-04-25 13:59:00 +0000,unfulfilled,GBP,620.00,2026-04-25 13:59:00 +0000,1,Night Garden - Framed,620.00,SKU,Alice Novak,Alice Novak,United Kingdom,
#AA10954,stefan.boyle@example.com,paid,2026-04-25 14:06:00 +0000,unfulfilled,GBP,620.00,2026-04-25 14:06:00 +0000,1,Night Garden - Unframed,620.00,SKU,Stefan Boyle,Stefan Boyle,United Kingdom,repeat-collector
#AA10955,tariq.toft@example.com,paid,2026-04-25 15:13:00 +0000,unfulfilled,USD,620.00,2026-04-25 15:13:00 +0000,1,Night Garden - Unframed,620.00,SKU,Tariq Toft,Tariq Toft,Australia,
#AA10956,leila.brand@example.com,paid,2026-04-25 16:20:00 +0000,unfulfilled,EUR,620.00,2026-04-25 16:20:00 +0000,1,Night Garden - Unframed,620.00,SKU,Leila Brand,Leila Brand,Sweden,
#AA10959,hana.marchetti@example.com,paid,2026-04-25 08:27:00 +0000,unfulfilled,GBP,620.00,2026-04-25 08:27:00 +0000,1,Night Garden - Unframed,620.00,SKU,Hana Marchetti,Hana Marchetti,United Kingdom,gift-order
#AA10960,chiara.delgado@example.com,paid,2026-04-26 09:34:00 +0000,unfulfilled,GBP,620.00,2026-04-26 09:34:00 +0000,1,Night Garden - Framed,620.00,SKU,Chiara Delgado,Chiara Delgado,United Kingdom,
#AA10963,henrik.rossi@example.com,paid,2026-04-26 10:41:00 +0000,unfulfilled,USD,620.00,2026-04-26 10:41:00 +0000,1,Night Garden - Framed,620.00,SKU,Henrik Rossi,Henrik Rossi,United States,vip
#AA10964,petra.brooks@example.com,paid,2026-04-26 11:48:00 +0000,unfulfilled,USD,620.00,2026-04-26 11:48:00 +0000,1,Night Garden - Unframed,620.00,SKU,Petra Brooks,Petra Brooks,United States,"vip,repeat-collector"
#AA10966,elif.acheampong@example.com,paid,2026-04-26 12:55:00 +0000,unfulfilled,GBP,620.00,2026-04-26 12:55:00 +0000,1,Night Garden - Unframed,620.00,SKU,Elif Acheampong,Elif Acheampong,United Kingdom,
#AA10968,marco.falk@example.com,paid,2026-04-26 13:02:00 +0000,unfulfilled,GBP,620.00,2026-04-26 13:02:00 +0000,1,Night Garden - Framed,620.00,SKU,Marco Falk,Marco Falk,United Kingdom,
#AA10970,sanne.vermeer@example.com,paid,2026-04-26 14:09:00 +0000,unfulfilled,EUR,620.00,2026-04-26 14:09:00 +0000,1,Night Garden - Unframed,620.00,SKU,Sanne Vermeer,Sanne Vermeer,Germany,
#AA10972,nadia.kowalska@example.com,paid,2026-04-26 15:16:00 +0000,unfulfilled,EUR,620.00,2026-04-26 15:16:00 +0000,1,Night Garden - Unframed,620.00,SKU,Nadia Kowalska,Nadia Kowalska,Germany,"vip,repeat-collector"
#AA10973,diego.larsen@example.com,paid,2026-04-26 16:23:00 +0000,unfulfilled,EUR,620.00,2026-04-26 16:23:00 +0000,1,Night Garden - Framed,620.00,SKU,Diego Larsen,Diego Larsen,France,
#AA10976,marco.raman@example.com,paid,2026-04-26 08:30:00 +0000,unfulfilled,USD,620.00,2026-04-26 08:30:00 +0000,1,Night Garden - Framed,620.00,SKU,Marco Raman,Marco Raman,Japan,newsletter
#AA10978,aya.vos@example.com,paid,2026-04-27 09:37:00 +0000,unfulfilled,EUR,620.00,2026-04-27 09:37:00 +0000,1,Night Garden - Framed,620.00,SKU,Aya Vos,Aya Vos,Spain,
#AA10980,roos.kowalska@example.com,paid,2026-04-27 10:44:00 +0000,unfulfilled,EUR,620.00,2026-04-27 10:44:00 +0000,1,Night Garden - Unframed,620.00,SKU,Roos Kowalska,Roos Kowalska,Germany,gift-order
#AA10981,chiara.raman@example.com,paid,2026-04-27 11:51:00 +0000,unfulfilled,GBP,620.00,2026-04-27 11:51:00 +0000,1,Night Garden - Framed,620.00,SKU,Chiara Raman,Chiara Raman,United Kingdom,
#AA10984,marta.okonkwo@example.com,paid,2026-04-27 12:58:00 +0000,unfulfilled,EUR,620.00,2026-04-27 12:58:00 +0000,1,Night Garden - Framed,620.00,SKU,Marta Okonkwo,Marta Okonkwo,Netherlands,
#AA10987,camille.ferreira@example.com,paid,2026-04-27 13:05:00 +0000,unfulfilled,EUR,620.00,2026-04-27 13:05:00 +0000,1,Night Garden - Framed,620.00,SKU,Camille Ferreira,Camille Ferreira,Germany,
#AA10989,hana.osei@example.com,paid,2026-04-27 14:12:00 +0000,unfulfilled,GBP,620.00,2026-04-27 14:12:00 +0000,1,Night Garden - Unframed,620.00,SKU,Hana Osei,Hana Osei,United Kingdom,gift-order
#AA10990,mia.mensah@example.com,paid,2026-04-27 15:19:00 +0000,unfulfilled,GBP,620.00,2026-04-27 15:19:00 +0000,1,Night Garden - Unframed,620.00,SKU,Mia Mensah,Mia Mensah,United Kingdom,newsletter
#AA10991,malik.kaplan@example.com,paid,2026-04-27 16:26:00 +0000,unfulfilled,GBP,620.00,2026-04-27 16:26:00 +0000,1,Night Garden - Framed,620.00,SKU,Malik Kaplan,Malik Kaplan,United Kingdom,repeat-collector
#AA10992,anouk.iversen@example.com,paid,2026-04-27 08:33:00 +0000,unfulfilled,EUR,620.00,2026-04-27 08:33:00 +0000,1,Night Garden - Unframed,620.00,SKU,Anouk Iversen,Anouk Iversen,Denmark,
#AA10994,mateo.blom@example.com,paid,2026-04-28 09:40:00 +0000,unfulfilled,EUR,620.00,2026-04-28 09:40:00 +0000,1,Night Garden - Unframed,620.00,SKU,Mateo Blom,Mateo Blom,Netherlands,
#AA10996,chiara.vos@example.com,paid,2026-04-28 10:47:00 +0000,unfulfilled,GBP,620.00,2026-04-28 10:47:00 +0000,1,Night Garden - Framed,620.00,SKU,Chiara Vos,Chiara Vos,United Kingdom,repeat-collector
#AA10997,dmitri.haugen@example.com,paid,2026-04-28 11:54:00 +0000,unfulfilled,GBP,620.00,2026-04-28 11:54:00 +0000,1,Night Garden - Unframed,620.00,SKU,Dmitri Haugen,Dmitri Haugen,United Kingdom,
#AA10998,otto.oduya@example.com,paid,2026-04-28 12:01:00 +0000,unfulfilled,EUR,620.00,2026-04-28 12:01:00 +0000,1,Night Garden - Framed,620.00,SKU,Otto Oduya,Otto Oduya,Germany,
#AA11000,bram.lindqvist@example.com,paid,2026-04-28 13:08:00 +0000,unfulfilled,EUR,620.00,2026-04-28 13:08:00 +0000,1,Night Garden - Unframed,620.00,SKU,Bram Lindqvist,Bram Lindqvist,Germany,
#AA11001,anders.sandberg@example.com,paid,2026-04-28 14:15:00 +0000,unfulfilled,EUR,620.00,2026-04-28 14:15:00 +0000,1,Night Garden - Framed,620.00,SKU,Anders Sandberg,Anders Sandberg,Spain,
#AA11004,diego.moreau@example.com,paid,2026-04-28 15:22:00 +0000,unfulfilled,GBP,620.00,2026-04-28 15:22:00 +0000,1,Night Garden - Framed,620.00,SKU,Diego Moreau,Diego Moreau,United Kingdom,newsletter
#AA11007,marco.bakker@example.com,paid,2026-04-28 16:29:00 +0000,unfulfilled,USD,620.00,2026-04-28 16:29:00 +0000,1,Night Garden - Framed,620.00,SKU,Marco Bakker,Marco Bakker,United States,
#AA11008,leila.lindgren@example.com,paid,2026-04-28 08:36:00 +0000,unfulfilled,EUR,620.00,2026-04-28 08:36:00 +0000,1,Night Garden - Framed,620.00,SKU,Leila Lindgren,Leila Lindgren,Germany,vip
#AA11009,clara.silva@example.com,paid,2026-04-28 09:43:00 +0000,unfulfilled,EUR,620.00,2026-04-28 09:43:00 +0000,1,Night Garden - Framed,620.00,SKU,Clara Silva,Clara Silva,France,
#AA11010,anders.novak@example.com,paid,2026-05-01 10:50:00 +0000,unfulfilled,USD,620.00,2026-05-01 10:50:00 +0000,1,Night Garden - Unframed,620.00,SKU,Anders Novak,Anders Novak,United States,gift-order
#AA11011,pierre.adeyemi@example.com,paid,2026-05-01 11:57:00 +0000,unfulfilled,USD,620.00,2026-05-01 11:57:00 +0000,1,Night Garden - Unframed,620.00,SKU,Pierre Adeyemi,Pierre Adeyemi,United States,
#AA11013,nadia.okafor@example.com,paid,2026-05-01 12:04:00 +0000,unfulfilled,USD,620.00,2026-05-01 12:04:00 +0000,1,Night Garden - Framed,620.00,SKU,Nadia Okafor,Nadia Okafor,United States,repeat-collector
#AA11015,casper.kowalska@example.com,paid,2026-05-01 13:11:00 +0000,unfulfilled,GBP,620.00,2026-05-01 13:11:00 +0000,1,Night Garden - Framed,620.00,SKU,Casper Kowalska,Casper Kowalska,United Kingdom,
#AA11016,liam.halvorsen@example.com,paid,2026-05-01 14:18:00 +0000,unfulfilled,GBP,620.00,2026-05-01 14:18:00 +0000,1,Night Garden - Framed,620.00,SKU,Liam Halvorsen,Liam Halvorsen,United Kingdom,vip
#AA11019,sofia.hoffmann@example.com,paid,2026-05-01 15:25:00 +0000,unfulfilled,EUR,620.00,2026-05-01 15:25:00 +0000,1,Night Garden - Unframed,620.00,SKU,Sofia Hoffmann,Sofia Hoffmann,Germany,
#AA11020,stefan.raman@example.com,paid,2026-05-01 16:32:00 +0000,unfulfilled,EUR,620.00,2026-05-01 16:32:00 +0000,1,Night Garden - Unframed,620.00,SKU,Stefan Raman,Stefan Raman,Germany,
#AA11022,alice.dubois@example.com,paid,2026-05-01 08:39:00 +0000,unfulfilled,USD,620.00,2026-05-01 08:39:00 +0000,1,Night Garden - Unframed,620.00,SKU,Alice Dubois,Alice Dubois,United States,
`;

/**
 * Warehouse edition-allocation sheet for Falling Light, in the real sheet's
 * shape: junk validation rows above the header, a blank leading column,
 * framing columns empty for "Print Only" rows, an artist's proof ("AP")
 * edition, a multi-line-item order (#AA10418) with one framed and one
 * unframed row, two orders the warehouse hasn't allocated yet (#AA10448,
 * #AA10449) and one sheet row with no matching order (#AA10999).
 */
export const FALLING_LIGHT_ALLOCATION_CSV = `,,#REF!,0,0,TRUE,,,,Mismatches:,0
,,,0,0,TRUE,,,,,All multi-print orders have consistent edition numbers
,Order Number,Print Name,Fulfilment,Frame Finish,Glass,Mounting Type,Set_Size,Edition No.,,
,#AA10412,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,1,,
,#AA10413,Falling Light,Print Only,,,,1,2,,
,#AA10415,Falling Light,Print Only,,,,1,3,,
,#AA10416,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,4,,
,#AA10418,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,2,5,,
,#AA10418,Falling Light,Print Only,,,,2,5,,
,#AA10419,Falling Light,Framed,DARK BROWN,Museum-grade acrylic,WINDOW,1,6,,
,#AA10421,Falling Light,Print Only,,,,1,7,,
,#AA10422,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,8,,
,#AA10425,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,9,,
,#AA10427,Falling Light,Print Only,,,,1,AP,,
,#AA10428,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,10,,
,#AA10430,Falling Light,Print Only,,,,1,11,,
,#AA10431,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,12,,
,#AA10433,Falling Light,Framed,GREEN,UV-protective acrylic,FLOAT,1,13,,
,#AA10434,Falling Light,Print Only,,,,1,14,,
,#AA10436,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,15,,
,#AA10437,Falling Light,Print Only,,,,1,16,,
,#AA10439,Falling Light,Framed,WHITE,Museum-grade acrylic,FLOAT,1,17,,
,#AA10440,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,18,,
,#AA10442,Falling Light,Print Only,,,,1,19,,
,#AA10443,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,20,,
,#AA10445,Falling Light,Print Only,,,,1,21,,
,#AA10446,Falling Light,Framed,BURGUNDY,UV-protective acrylic,FLOAT,1,22,,
,#AA10999,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,23,,
,#AA10452,Falling Light,Print Only,,,,1,257,,
,#AA10453,Falling Light,Print Only,,,,1,258,,
,#AA10454,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,259,,
,#AA10456,Falling Light,Print Only,,,,1,24,,
,#AA10459,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,WINDOW,1,25,,
,#AA10460,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,26,,
,#AA10463,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,27,,
,#AA10466,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,28,,
,#AA10467,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,29,,
,#AA10469,Falling Light,Print Only,,,,1,30,,
,#AA10472,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,31,,
,#AA10473,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,32,,
,#AA10474,Falling Light,Print Only,,,,1,33,,
,#AA10475,Falling Light,Print Only,,,,1,34,,
,#AA10476,Falling Light,Print Only,,,,1,35,,
,#AA10477,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,36,,
,#AA10478,Falling Light,Print Only,,,,1,37,,
,#AA10479,Falling Light,Framed,NATURAL OAK,Museum-grade acrylic,FLOAT,1,38,,
,#AA10480,Falling Light,Print Only,,,,1,39,,
,#AA10481,Falling Light,Print Only,,,,1,40,,
,#AA10485,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,41,,
,#AA10488,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,42,,
,#AA10490,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,WINDOW,1,43,,
,#AA10492,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,44,,
,#AA10493,Falling Light,Print Only,,,,1,45,,
,#AA10495,Falling Light,Framed,DARK BROWN,Museum-grade acrylic,FLOAT,1,46,,
,#AA10499,Falling Light,Print Only,,,,1,47,,
,#AA10502,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,48,,
,#AA10505,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,49,,
,#AA10506,Falling Light,Print Only,,,,1,50,,
,#AA10509,Falling Light,Print Only,,,,1,51,,
,#AA10510,Falling Light,Framed,WHITE,Museum-grade acrylic,FLOAT,1,52,,
,#AA10511,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,53,,
,#AA10516,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,54,,
,#AA10517,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,55,,
,#AA10520,Falling Light,Print Only,,,,1,56,,
,#AA10521,Falling Light,Print Only,,,,1,57,,
,#AA10522,Falling Light,Print Only,,,,1,58,,
,#AA10524,Falling Light,Framed,DARK BROWN,UV-protective acrylic,FLOAT,1,59,,
,#AA10528,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,60,,
,#AA10531,Falling Light,Print Only,,,,1,61,,
,#AA10533,Falling Light,Framed,BLACK,UV-protective acrylic,WINDOW,1,62,,
,#AA10539,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,WINDOW,1,63,,
,#AA10541,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,64,,
,#AA10542,Falling Light,Print Only,,,,1,65,,
,#AA10543,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,66,,
,#AA10546,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,67,,
,#AA10549,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,68,,
,#AA10552,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,69,,
,#AA10555,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,70,,
,#AA10557,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,71,,
,#AA10558,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,72,,
,#AA10559,Falling Light,Print Only,,,,1,73,,
,#AA10562,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,74,,
,#AA10565,Falling Light,Framed,DARK BROWN,UV-protective acrylic,FLOAT,1,75,,
,#AA10567,Falling Light,Print Only,,,,1,76,,
,#AA10568,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,77,,
,#AA10569,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,78,,
,#AA10573,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,79,,
,#AA10574,Falling Light,Framed,WHITE,UV-protective acrylic,WINDOW,1,80,,
,#AA10577,Falling Light,Print Only,,,,1,81,,
,#AA10578,Falling Light,Print Only,,,,1,82,,
,#AA10581,Falling Light,Print Only,,,,1,83,,
,#AA10582,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,84,,
,#AA10585,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,85,,
,#AA10586,Falling Light,Print Only,,,,1,86,,
,#AA10587,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,87,,
,#AA10590,Falling Light,Print Only,,,,1,88,,
,#AA10592,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,89,,
,#AA10594,Falling Light,Framed,DARK BROWN,UV-protective acrylic,FLOAT,1,90,,
,#AA10596,Falling Light,Print Only,,,,1,91,,
,#AA10597,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,92,,
,#AA10600,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,93,,
,#AA10601,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,94,,
,#AA10602,Falling Light,Framed,BLACK,Museum-grade acrylic,FLOAT,1,95,,
,#AA10603,Falling Light,Print Only,,,,1,96,,
,#AA10605,Falling Light,Framed,WHITE,Museum-grade acrylic,FLOAT,1,97,,
,#AA10606,Falling Light,Print Only,,,,1,98,,
,#AA10611,Falling Light,Print Only,,,,1,99,,
,#AA10612,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,100,,
,#AA10613,Falling Light,Print Only,,,,1,101,,
,#AA10614,Falling Light,Print Only,,,,1,102,,
,#AA10615,Falling Light,Print Only,,,,1,103,,
,#AA10618,Falling Light,Print Only,,,,1,104,,
,#AA10620,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,105,,
,#AA10621,Falling Light,Print Only,,,,1,106,,
,#AA10624,Falling Light,Print Only,,,,1,107,,
,#AA10625,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,108,,
,#AA10626,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,109,,
,#AA10628,Falling Light,Print Only,,,,1,110,,
,#AA10631,Falling Light,Print Only,,,,1,111,,
,#AA10632,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,112,,
,#AA10633,Falling Light,Framed,DARK BROWN,UV-protective acrylic,FLOAT,1,113,,
,#AA10635,Falling Light,Framed,DARK BROWN,UV-protective acrylic,FLOAT,1,114,,
,#AA10638,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,WINDOW,1,115,,
,#AA10639,Falling Light,Framed,BLACK,UV-protective acrylic,WINDOW,1,116,,
,#AA10641,Falling Light,Framed,DARK BROWN,UV-protective acrylic,FLOAT,1,117,,
,#AA10642,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,WINDOW,1,118,,
,#AA10643,Falling Light,Framed,BLACK,Museum-grade acrylic,WINDOW,1,119,,
,#AA10645,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,120,,
,#AA10646,Falling Light,Print Only,,,,1,121,,
,#AA10649,Falling Light,Print Only,,,,1,122,,
,#AA10650,Falling Light,Print Only,,,,1,123,,
,#AA10652,Falling Light,Print Only,,,,1,124,,
,#AA10655,Falling Light,Print Only,,,,1,125,,
,#AA10656,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,126,,
,#AA10658,Falling Light,Print Only,,,,1,127,,
,#AA10660,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,128,,
,#AA10665,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,129,,
,#AA10666,Falling Light,Print Only,,,,1,130,,
,#AA10668,Falling Light,Print Only,,,,1,131,,
,#AA10670,Falling Light,Framed,WHITE,Museum-grade acrylic,FLOAT,1,132,,
,#AA10671,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,133,,
,#AA10673,Falling Light,Print Only,,,,1,134,,
,#AA10676,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,135,,
,#AA10677,Falling Light,Framed,WHITE,UV-protective acrylic,WINDOW,1,136,,
,#AA10679,Falling Light,Print Only,,,,1,137,,
,#AA10680,Falling Light,Print Only,,,,1,138,,
,#AA10681,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,139,,
,#AA10682,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,140,,
,#AA10683,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,141,,
,#AA10686,Falling Light,Print Only,,,,1,142,,
,#AA10688,Falling Light,Print Only,,,,1,143,,
,#AA10690,Falling Light,Print Only,,,,1,144,,
,#AA10693,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,145,,
,#AA10696,Falling Light,Print Only,,,,1,146,,
,#AA10699,Falling Light,Print Only,,,,1,147,,
,#AA10700,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,148,,
,#AA10703,Falling Light,Print Only,,,,1,149,,
,#AA10705,Falling Light,Print Only,,,,1,150,,
,#AA10706,Falling Light,Print Only,,,,1,151,,
,#AA10707,Falling Light,Print Only,,,,1,152,,
,#AA10710,Falling Light,Print Only,,,,1,153,,
,#AA10711,Falling Light,Print Only,,,,1,154,,
,#AA10712,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,155,,
,#AA10714,Falling Light,Print Only,,,,1,156,,
,#AA10716,Falling Light,Framed,BLACK,UV-protective acrylic,WINDOW,1,157,,
,#AA10717,Falling Light,Print Only,,,,1,158,,
,#AA10718,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,159,,
,#AA10719,Falling Light,Framed,WHITE,UV-protective acrylic,WINDOW,1,160,,
,#AA10720,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,161,,
,#AA10722,Falling Light,Print Only,,,,1,162,,
,#AA10723,Falling Light,Print Only,,,,1,163,,
,#AA10725,Falling Light,Print Only,,,,1,164,,
,#AA10727,Falling Light,Print Only,,,,1,165,,
,#AA10729,Falling Light,Print Only,,,,1,166,,
,#AA10732,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,167,,
,#AA10733,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,168,,
,#AA10734,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,169,,
,#AA10736,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,170,,
,#AA10737,Falling Light,Print Only,,,,1,171,,
,#AA10740,Falling Light,Print Only,,,,1,172,,
,#AA10743,Falling Light,Print Only,,,,1,173,,
,#AA10745,Falling Light,Print Only,,,,1,174,,
,#AA10747,Falling Light,Print Only,,,,1,175,,
,#AA10748,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,176,,
,#AA10749,Falling Light,Framed,NATURAL OAK,Museum-grade acrylic,FLOAT,1,177,,
,#AA10750,Falling Light,Print Only,,,,1,178,,
,#AA10753,Falling Light,Print Only,,,,1,179,,
,#AA10757,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,180,,
,#AA10759,Falling Light,Print Only,,,,1,181,,
,#AA10762,Falling Light,Print Only,,,,1,182,,
,#AA10765,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,183,,
,#AA10766,Falling Light,Framed,NATURAL OAK,Museum-grade acrylic,FLOAT,1,184,,
,#AA10767,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,185,,
,#AA10768,Falling Light,Framed,DARK BROWN,UV-protective acrylic,FLOAT,1,186,,
,#AA10771,Falling Light,Framed,WHITE,Museum-grade acrylic,FLOAT,1,187,,
,#AA10774,Falling Light,Print Only,,,,1,188,,
,#AA10777,Falling Light,Print Only,,,,1,189,,
,#AA10779,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,190,,
,#AA10782,Falling Light,Framed,NATURAL OAK,Museum-grade acrylic,FLOAT,1,191,,
,#AA10783,Falling Light,Print Only,,,,1,192,,
,#AA10784,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,193,,
,#AA10785,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,194,,
,#AA10787,Falling Light,Framed,BLACK,UV-protective acrylic,WINDOW,1,195,,
,#AA10789,Falling Light,Framed,BLACK,UV-protective acrylic,WINDOW,1,196,,
,#AA10791,Falling Light,Print Only,,,,1,197,,
,#AA10794,Falling Light,Print Only,,,,1,198,,
,#AA10796,Falling Light,Print Only,,,,1,199,,
,#AA10797,Falling Light,Framed,BLACK,UV-protective acrylic,WINDOW,1,200,,
,#AA10798,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,201,,
,#AA10800,Falling Light,Print Only,,,,1,202,,
,#AA10805,Falling Light,Print Only,,,,1,203,,
,#AA10806,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,204,,
,#AA10807,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,205,,
,#AA10808,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,206,,
,#AA10811,Falling Light,Framed,DARK BROWN,Museum-grade acrylic,FLOAT,1,207,,
,#AA10812,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,208,,
,#AA10813,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,209,,
,#AA10816,Falling Light,Print Only,,,,1,210,,
,#AA10817,Falling Light,Print Only,,,,1,211,,
,#AA10821,Falling Light,Framed,BLACK,Museum-grade acrylic,WINDOW,1,212,,
,#AA10824,Falling Light,Print Only,,,,1,213,,
,#AA10825,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,214,,
,#AA10828,Falling Light,Print Only,,,,1,215,,
,#AA10831,Falling Light,Print Only,,,,1,216,,
,#AA10833,Falling Light,Print Only,,,,1,217,,
,#AA10838,Falling Light,Print Only,,,,1,218,,
,#AA10841,Falling Light,Print Only,,,,1,219,,
,#AA10843,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,220,,
,#AA10844,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,221,,
,#AA10848,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,222,,
,#AA10849,Falling Light,Print Only,,,,1,223,,
,#AA10851,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,224,,
,#AA10852,Falling Light,Framed,WHITE,UV-protective acrylic,WINDOW,1,225,,
,#AA10853,Falling Light,Print Only,,,,1,226,,
,#AA10856,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,227,,
,#AA10857,Falling Light,Framed,DARK BROWN,UV-protective acrylic,FLOAT,1,228,,
,#AA10858,Falling Light,Print Only,,,,1,229,,
,#AA10859,Falling Light,Print Only,,,,1,230,,
,#AA10860,Falling Light,Print Only,,,,1,231,,
,#AA10861,Falling Light,Print Only,,,,1,232,,
,#AA10864,Falling Light,Print Only,,,,1,233,,
,#AA10868,Falling Light,Print Only,,,,1,234,,
,#AA10871,Falling Light,Framed,WHITE,Museum-grade acrylic,FLOAT,1,235,,
,#AA10872,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,236,,
,#AA10876,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,237,,
,#AA10879,Falling Light,Print Only,,,,1,238,,
,#AA10882,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,239,,
,#AA10883,Falling Light,Framed,NATURAL OAK,Museum-grade acrylic,FLOAT,1,240,,
,#AA10886,Falling Light,Framed,NATURAL OAK,UV-protective acrylic,FLOAT,1,241,,
,#AA10888,Falling Light,Print Only,,,,1,242,,
,#AA10889,Falling Light,Print Only,,,,1,243,,
,#AA10892,Falling Light,Print Only,,,,1,244,,
,#AA10893,Falling Light,Print Only,,,,1,245,,
,#AA10895,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,246,,
,#AA10898,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,247,,
,#AA10902,Falling Light,Framed,BLACK,UV-protective acrylic,FLOAT,1,248,,
,#AA10903,Falling Light,Print Only,,,,1,249,,
,#AA10904,Falling Light,Framed,DARK BROWN,UV-protective acrylic,FLOAT,1,250,,
,#AA10905,Falling Light,Print Only,,,,1,251,,
,#AA10906,Falling Light,Framed,WHITE,UV-protective acrylic,WINDOW,1,252,,
,#AA10907,Falling Light,Print Only,,,,1,253,,
,#AA10910,Falling Light,Framed,WHITE,UV-protective acrylic,FLOAT,1,254,,
,#AA10914,Falling Light,Print Only,,,,1,255,,
,#AA10915,Falling Light,Print Only,,,,1,256,,
`;

/**
 * Fake HubSpot contact directory (email → contact id). Deliberately missing:
 *   - tom.rivera@example.net   (Falling Light — flagged at import)
 *   - arthur.beaumont@example.net (Vessel VIII — flagged at import)
 *   - charles.whitmore@example.net (Night Garden — flagged at import)
 * The phase-2 implementation replaces this with the HubSpot contacts API.
 */
export const HUBSPOT_DIRECTORY: Record<string, string> = {
  'jane.whitfield@example.com': '30101',
  'marcus.oduya@example.com': '30102',
  'chidi.okafor@example.org': '30103',
  'sofia.lindqvist@example.com': '30104',
  'priya.raman@example.com': '30105',
  'daan.vermeer@example.com': '30106',
  'ines.moreau@example.com': '30107',
  'felix.brand@example.com': '30108',
  'amara.diallo@example.com': '30109',
  'noah.gallagher@example.org': '30110',
  'yuki.tanaka@example.com': '30111',
  'lars.petersen@example.net': '30112',
  'greta.hoffmann@example.com': '30113',
  'alice.ngata@example.com': '30114',
  'ben.osei@example.com': '30115',
  'clara.jimenez@example.org': '30116',
  'oliver.hart@example.com': '30117',
  'maja.kowalska@example.com': '30118',
  'ethan.brooks@example.com': '30119',
  'nadia.hassan@example.com': '30120',
  'leo.marchetti@example.org': '30121',
  'freya.dunbar@example.com': '30122',
  'william.acheampong@example.com': '30123',
  'rosa.delgado@example.com': '30124',
  'imogen.clarke@example.com': '30201',
  'henrik.dahl@example.com': '30202',
  'mei.wong@example.org': '30203',
  'lucia.ferrari@example.com': '30205',
  'jonas.weber@example.com': '30206',
  'sarah.mbeki@example.com': '30207',
  'pieter.janssen@example.com': '30208',
  'eva.novak@example.com': '30301',
  'george.baptiste@example.com': '30302',
  'hana.suzuki@example.org': '30303',
  'ivan.petrov@example.com': '30304',
  'julia.silva@example.com': '30305',
  'kwame.asante@example.com': '30306',
  'olive.fitzgerald@example.com': '30401',
  'ravi.sharma@example.com': '30402',
  'dina.khoury@example.com': '30403',
  'emil.johansson@example.com': '30404',
  'fatima.zahra@example.org': '30405',
  /* The generated collectors, all of whom HubSpot knows about. The
     handful of orders that are deliberately unreachable are the
     hand-written ones above — an unresolvable contact is an exception a
     release has one or two of, not the normal case. */
  'yannick.vasquez@example.com': 'hs-6000',
  'franka.ostrowski@example.com': 'hs-6001',
  'xenia.castillo@example.com': 'hs-6002',
  'quinn.grieg@example.com': 'hs-6003',
  'oona.halvorsen@example.com': 'hs-6004',
  'otto.nyberg@example.com': 'hs-6005',
  'celine.ostrowski@example.com': 'hs-6006',
  'vera.toivonen@example.com': 'hs-6007',
  'farid.ibarra@example.com': 'hs-6008',
  'franka.fontaine@example.com': 'hs-6009',
  'beatriz.halvorsen@example.com': 'hs-6010',
  'matteo.vasquez@example.com': 'hs-6011',
  'iker.bergstrom@example.com': 'hs-6012',
  'vera.halvorsen@example.com': 'hs-6013',
  'otto.grieg@example.com': 'hs-6014',
  'gustav.grieg@example.com': 'hs-6015',
  'yannick.ibarra@example.com': 'hs-6016',
  'ulla.ulriksen@example.com': 'hs-6017',
  'delphine.lindholm@example.com': 'hs-6018',
  'katja.sandoval@example.com': 'hs-6019',
  'ulla.ibarra@example.com': 'hs-6020',
  'iker.toivonen@example.com': 'hs-6021',
  'eamon.halvorsen@example.com': 'hs-6022',
  'aksel.sandoval@example.com': 'hs-6023',
  'bastian.wexler@example.com': 'hs-6024',
  'quinn.lindholm@example.com': 'hs-6025',
  'nikolai.toivonen@example.com': 'hs-6026',
  'yara.grieg@example.com': 'hs-6027',
  'thijs.nyberg@example.com': 'hs-6028',
  'valentin.bianchi@example.com': 'hs-6029',
  'ulla.ostrowski@example.com': 'hs-6030',
  'corentin.eriksen@example.com': 'hs-6031',
  'rasmus.sandoval@example.com': 'hs-6032',
  'umberto.ibarra@example.com': 'hs-6033',
  'tove.zetterberg@example.com': 'hs-6034',
  'zeno.lindholm@example.com': 'hs-6035',
  'stellan.ulriksen@example.com': 'hs-6036',
  'dmitri.wexler@example.com': 'hs-6037',
  'wiktor.ostrowski@example.com': 'hs-6038',
  'pavel.halvorsen@example.com': 'hs-6039',
  'aksel.castillo@example.com': 'hs-6040',
  'noor.ibarra@example.com': 'hs-6041',
  'paloma.toivonen@example.com': 'hs-6042',
  'yara.halvorsen@example.com': 'hs-6043',
  'pavel.dahlberg@example.com': 'hs-6044',
  'jolanta.ostrowski@example.com': 'hs-6045',
  'zeno.grieg@example.com': 'hs-6046',
  'renate.jansen@example.com': 'hs-6047',
  'katja.lindholm@example.com': 'hs-6048',
  'vera.abramsen@example.com': 'hs-6049',
  'noor.castillo@example.com': 'hs-6050',
  'otto.bergstrom@example.com': 'hs-6051',
  'noor.nyberg@example.com': 'hs-6052',
  'ulla.jansen@example.com': 'hs-6053',
  'xenia.ibarra@example.com': 'hs-6054',
  'xenia.halvorsen@example.com': 'hs-6055',
  'thijs.abramsen@example.com': 'hs-6056',
  'quinn.ulriksen@example.com': 'hs-6057',
  'valentin.grieg@example.com': 'hs-6058',
  'delphine.abramsen@example.com': 'hs-6059',
  'wiktor.bianchi@example.com': 'hs-6060',
  'quinn.halvorsen@example.com': 'hs-6061',
  'matteo.grieg@example.com': 'hs-6062',
  'umberto.lindholm@example.com': 'hs-6063',
  'sanne.ulriksen@example.com': 'hs-6064',
  'thijs.engel@example.com': 'hs-6065',
  'yara.rousseau@example.com': 'hs-6066',
  'zofia.rousseau@example.com': 'hs-6067',
  'farid.aalto@example.com': 'hs-6068',
  'umberto.grieg@example.com': 'hs-6069',
  'hugo.abramsen@example.com': 'hs-6070',
  'kasper.halvorsen@example.com': 'hs-6071',
  'vera.aalto@example.com': 'hs-6072',
  'bastian.corsten@example.com': 'hs-6073',
  'yannick.rousseau@example.com': 'hs-6074',
  'xenia.abramsen@example.com': 'hs-6075',
  'lorenzo.dupont@example.com': 'hs-6076',
  'lorenzo.dahlberg@example.com': 'hs-6077',
  'delphine.bergstrom@example.com': 'hs-6078',
  'hugo.lindholm@example.com': 'hs-6079',
  'katja.abramsen@example.com': 'hs-6080',
  'iker.dupont@example.com': 'hs-6081',
  'celine.kristensen@example.com': 'hs-6082',
  'hugo.ibarra@example.com': 'hs-6083',
  'dmitri.eriksen@example.com': 'hs-6084',
  'zofia.kristensen@example.com': 'hs-6085',
  'ulla.dahlberg@example.com': 'hs-6086',
  'yara.fontaine@example.com': 'hs-6087',
  'xenia.zetterberg@example.com': 'hs-6088',
  'gustav.toivonen@example.com': 'hs-6089',
  'dmitri.halvorsen@example.com': 'hs-6090',
  'rasmus.kristensen@example.com': 'hs-6091',
  'vera.lindholm@example.com': 'hs-6092',
  'zofia.toivonen@example.com': 'hs-6093',
  'pavel.eriksen@example.com': 'hs-6094',
  'greta.kristensen@example.com': 'hs-6095',
  'noor.ylonen@example.com': 'hs-6096',
  'greta.sandoval@example.com': 'hs-6097',
  'valentin.aalto@example.com': 'hs-6098',
  'aksel.bergstrom@example.com': 'hs-6099',
  'linnea.aalto@example.com': 'hs-6100',
  'hugo.zetterberg@example.com': 'hs-6101',
  'wanda.ulriksen@example.com': 'hs-6102',
  'ulla.lindholm@example.com': 'hs-6103',
  'hilde.ylonen@example.com': 'hs-6104',
  'oona.zetterberg@example.com': 'hs-6105',
  'gustav.dahlberg@example.com': 'hs-6106',
  'celine.abramsen@example.com': 'hs-6107',
  'gustav.ibarra@example.com': 'hs-6108',
  'zofia.jansen@example.com': 'hs-6109',
  'ingrid.ostrowski@example.com': 'hs-6110',
  'greta.halvorsen@example.com': 'hs-6111',
  'katja.zetterberg@example.com': 'hs-6112',
  'paloma.rousseau@example.com': 'hs-6113',
  'zofia.vasquez@example.com': 'hs-6114',
  'ingrid.halvorsen@example.com': 'hs-6115',
  'eamon.dahlberg@example.com': 'hs-6116',
  'jolanta.corsten@example.com': 'hs-6117',
  'rasmus.wexler@example.com': 'hs-6118',
  'delphine.ostrowski@example.com': 'hs-6119',
  'ingrid.engel@example.com': 'hs-6120',
  'farid.zetterberg@example.com': 'hs-6121',
  'thijs.halvorsen@example.com': 'hs-6122',
  'otto.abramsen@example.com': 'hs-6123',
  'renate.sandoval@example.com': 'hs-6124',
  'beatriz.bianchi@example.com': 'hs-6125',
  'noor.bergstrom@example.com': 'hs-6126',
  'vera.quist@example.com': 'hs-6127',
  'nikolai.quist@example.com': 'hs-6128',
  'kasper.bianchi@example.com': 'hs-6129',
  'tove.ylonen@example.com': 'hs-6130',
  'corentin.sandoval@example.com': 'hs-6131',
  'jolanta.wexler@example.com': 'hs-6132',
  'gustav.rousseau@example.com': 'hs-6133',
  'yannick.dupont@example.com': 'hs-6134',
  'wiktor.paquet@example.com': 'hs-6135',
  'paloma.dupont@example.com': 'hs-6136',
  'greta.bergstrom@example.com': 'hs-6137',
  'ulla.vasquez@example.com': 'hs-6138',
  'lorenzo.ylonen@example.com': 'hs-6139',
  'kasper.nyberg@example.com': 'hs-6140',
  'umberto.eriksen@example.com': 'hs-6141',
  'elena.marchetti@example.com': 'hs-5900',
  'tomas.b@example.org': 'hs-5901',
  'aiko.tanaka@example.com': 'hs-5902',
  'priya.nair@example.com': 'hs-5903',
  '"okoro, chidi"@example.org': 'hs-5904',
  'marion.lefevre@example.com': 'hs-5905',
  'alice.hoffmann@example.com': 'hs-4001',
  'theo.jimenez@example.com': 'hs-4002',
  'viktor.hoffmann@example.com': 'hs-4003',
  'sven.berger@example.com': 'hs-4004',
  'olivia.vos@example.com': 'hs-4005',
  'tariq.duarte@example.com': 'hs-4006',
  'olivia.lindqvist@example.com': 'hs-4007',
  'priya.brooks@example.com': 'hs-4008',
  'emil.berger@example.com': 'hs-4009',
  'elif.kowalska@example.com': 'hs-4010',
  'diego.lindqvist@example.com': 'hs-4011',
  'aleksander.brand@example.com': 'hs-4012',
  'talia.falk@example.com': 'hs-4013',
  'petra.hoffmann@example.com': 'hs-4014',
  'leila.sorensen@example.com': 'hs-4015',
  'liam.sandberg@example.com': 'hs-4016',
  'diego.iversen@example.com': 'hs-4017',
  'bo.hoffmann@example.com': 'hs-4018',
  'emil.raman@example.com': 'hs-4019',
  'casper.osei@example.com': 'hs-4020',
  'amara.boyle@example.com': 'hs-4021',
  'marta.duarte@example.com': 'hs-4022',
  'lucia.ferreira@example.com': 'hs-4023',
  'yuki.mensah@example.com': 'hs-4024',
  'rafael.jimenez@example.com': 'hs-4025',
  'kai.hassan@example.com': 'hs-4026',
  'hana.hassan@example.com': 'hs-4027',
  'bram.brooks@example.com': 'hs-4028',
  'petra.blom@example.com': 'hs-4029',
  'marta.lindgren@example.com': 'hs-4030',
  'sofia.oduya@example.com': 'hs-4031',
  'marco.andersen@example.com': 'hs-4032',
  'yuki.lange@example.com': 'hs-4033',
  'noah.duarte@example.com': 'hs-4034',
  'roos.hassan@example.com': 'hs-4035',
  'clara.toft@example.com': 'hs-4036',
  'bruno.acheampong@example.com': 'hs-4037',
  'elena.acheampong@example.com': 'hs-4038',
  'greta.moreau@example.com': 'hs-4039',
  'elena.bakker@example.com': 'hs-4040',
  'jan.brand@example.com': 'hs-4041',
  'liam.moreau@example.com': 'hs-4042',
  'liam.kaplan@example.com': 'hs-4043',
  'felix.silva@example.com': 'hs-4044',
  'rune.bakker@example.com': 'hs-4045',
  'idris.lindgren@example.com': 'hs-4046',
  'rune.weber@example.com': 'hs-4047',
  'camille.costa@example.com': 'hs-4048',
  'ida.nurmi@example.com': 'hs-4049',
  'elena.gallagher@example.com': 'hs-4050',
  'tariq.vermeer@example.com': 'hs-4051',
  'otto.brooks@example.com': 'hs-4052',
  'sven.rossi@example.com': 'hs-4053',
  'oscar.raman@example.com': 'hs-4054',
  'chiara.hoffmann@example.com': 'hs-4055',
  'anya.sorensen@example.com': 'hs-4056',
  'jonas.kaplan@example.com': 'hs-4057',
  'oscar.lindqvist@example.com': 'hs-4058',
  'aya.lindqvist@example.com': 'hs-4059',
  'freya.jimenez@example.com': 'hs-4060',
  'henrik.nurmi@example.com': 'hs-4061',
  'ida.vos@example.com': 'hs-4062',
  'nils.vermeer@example.com': 'hs-4063',
  'diego.osei@example.com': 'hs-4064',
  'maya.kaplan@example.com': 'hs-4065',
  'felix.sorensen@example.com': 'hs-4066',
  'tariq.adeyemi@example.com': 'hs-4067',
  'greta.rossi@example.com': 'hs-4068',
  'casper.diallo@example.com': 'hs-4069',
  'clara.lindgren@example.com': 'hs-4070',
  'malik.rasmussen@example.com': 'hs-4071',
  'chiara.rasmussen@example.com': 'hs-4072',
  'nils.ferreira@example.com': 'hs-4073',
  'priya.hoffmann@example.com': 'hs-4074',
  'otto.novak@example.com': 'hs-4075',
  'liam.silva@example.com': 'hs-4076',
  'pierre.lange@example.com': 'hs-4077',
  'nils.larsen@example.com': 'hs-4078',
  'rune.haugen@example.com': 'hs-4079',
  'signe.vos@example.com': 'hs-4080',
  'roos.dunbar@example.com': 'hs-4081',
  'marco.larsen@example.com': 'hs-4082',
  'sara.weber@example.com': 'hs-4083',
  'petra.okafor@example.com': 'hs-4084',
  'alice.weber@example.com': 'hs-4085',
  'viktor.adeyemi@example.com': 'hs-4086',
  'roos.osei@example.com': 'hs-4087',
  'talia.jimenez@example.com': 'hs-4088',
  'hana.lange@example.com': 'hs-4089',
  'camille.novak@example.com': 'hs-4090',
  'ines.lange@example.com': 'hs-4091',
  'yuki.grandi@example.com': 'hs-4092',
  'elif.delgado@example.com': 'hs-4093',
  'hugo.brooks@example.com': 'hs-4094',
  'zara.jimenez@example.com': 'hs-4095',
  'casper.adeyemi@example.com': 'hs-4096',
  'roos.novak@example.com': 'hs-4097',
  'tariq.nurmi@example.com': 'hs-4098',
  'nora.iversen@example.com': 'hs-4099',
  'bram.andersen@example.com': 'hs-4100',
  'noah.gallagher@example.com': 'hs-4101',
  'ines.rossi@example.com': 'hs-4102',
  'mattia.nakamura@example.com': 'hs-4103',
  'iris.fontaine@example.com': 'hs-4104',
  'mateo.keller@example.com': 'hs-4105',
  'joris.mensah@example.com': 'hs-4106',
  'rosa.okafor@example.com': 'hs-4107',
  'sara.whitfield@example.com': 'hs-4108',
  'talia.halvorsen@example.com': 'hs-4109',
  'nils.bakker@example.com': 'hs-4110',
  'yuki.ferreira@example.com': 'hs-4111',
  'ethan.sorensen@example.com': 'hs-4112',
  'amelia.brooks@example.com': 'hs-4113',
  'anya.lindgren@example.com': 'hs-4114',
  'isla.mensah@example.com': 'hs-4115',
  'noah.hoffmann@example.com': 'hs-4116',
  'talia.mensah@example.com': 'hs-4117',
  'nora.petersen@example.com': 'hs-4118',
  'maya.berger@example.com': 'hs-4119',
  'maya.rasmussen@example.com': 'hs-4120',
  'mattia.fontaine@example.com': 'hs-4121',
  'anya.raman@example.com': 'hs-4122',
  'anders.duarte@example.com': 'hs-4123',
  'lukas.hart@example.com': 'hs-4124',
  'sven.toft@example.com': 'hs-4125',
  'lucia.dubois@example.com': 'hs-4126',
  'leila.kaplan@example.com': 'hs-4127',
  'elif.rivera@example.com': 'hs-4128',
  'ines.osei@example.com': 'hs-4129',
  'solveig.sandberg@example.com': 'hs-4130',
  'chiara.gallagher@example.com': 'hs-4131',
  'felix.sandberg@example.com': 'hs-4132',
  'petra.sorensen@example.com': 'hs-4133',
  'elif.diallo@example.com': 'hs-4134',
  'roos.mensah@example.com': 'hs-4135',
  'signe.nakamura@example.com': 'hs-4136',
  'petra.mensah@example.com': 'hs-4137',
  'sara.dunbar@example.com': 'hs-4138',
  'nadia.delgado@example.com': 'hs-4139',
  'anouk.costa@example.com': 'hs-4140',
  'mia.nurmi@example.com': 'hs-4141',
  'alice.rasmussen@example.com': 'hs-4142',
  'jan.dunbar@example.com': 'hs-4143',
  'joris.nurmi@example.com': 'hs-4144',
  'priya.vos@example.com': 'hs-4145',
  'ava.bakker@example.com': 'hs-4146',
  'camille.nakamura@example.com': 'hs-4147',
  'freya.halvorsen@example.com': 'hs-4148',
  'rafael.novak@example.com': 'hs-4149',
  'alice.delgado@example.com': 'hs-4150',
  'pierre.silva@example.com': 'hs-4151',
  'casper.bakker@example.com': 'hs-4152',
  'nora.rasmussen@example.com': 'hs-4153',
  'olivia.grandi@example.com': 'hs-4154',
  'amara.marchetti@example.com': 'hs-4155',
  'marta.lindqvist@example.com': 'hs-4156',
  'jonas.costa@example.com': 'hs-4157',
  'tariq.acheampong@example.com': 'hs-4158',
  'elif.sandberg@example.com': 'hs-4159',
  'rosa.fontaine@example.com': 'hs-4160',
  'dmitri.boyle@example.com': 'hs-4161',
  'nadia.molnar@example.com': 'hs-4162',
  'leila.rasmussen@example.com': 'hs-4163',
  'marco.mensah@example.com': 'hs-4164',
  'pierre.kowalska@example.com': 'hs-4165',
  'sanne.toft@example.com': 'hs-4166',
  'mattia.aalto@example.com': 'hs-4167',
  'pierre.aalto@example.com': 'hs-4168',
  'bram.vermeer@example.com': 'hs-4169',
  'amara.brooks@example.com': 'hs-4170',
  'ida.lindgren@example.com': 'hs-4171',
  'petra.acheampong@example.com': 'hs-4172',
  'stefan.whitfield@example.com': 'hs-4173',
  'solveig.tanaka@example.com': 'hs-4174',
  'diego.grandi@example.com': 'hs-4175',
  'olivia.larsen@example.com': 'hs-4176',
  'casper.mensah@example.com': 'hs-4177',
  'rosa.jimenez@example.com': 'hs-4178',
  'sara.vermeer@example.com': 'hs-4179',
  'noah.mensah@example.com': 'hs-4180',
  'otto.hassan@example.com': 'hs-4181',
  'jonas.dubois@example.com': 'hs-4182',
  'bram.nurmi@example.com': 'hs-4183',
  'kai.bianchi@example.com': 'hs-4184',
  'diego.hassan@example.com': 'hs-4185',
  'anders.marchetti@example.com': 'hs-4186',
  'arthur.berger@example.com': 'hs-4187',
  'ethan.blom@example.com': 'hs-4188',
  'mateo.nurmi@example.com': 'hs-4189',
  'jan.falk@example.com': 'hs-4190',
  'bruno.costa@example.com': 'hs-4191',
  'freya.sandberg@example.com': 'hs-4192',
  'stefan.moreau@example.com': 'hs-4193',
  'amelia.acheampong@example.com': 'hs-4194',
  'pierre.berger@example.com': 'hs-4195',
  'aleksander.duarte@example.com': 'hs-4196',
  'anya.lindqvist@example.com': 'hs-4197',
  'idris.kaplan@example.com': 'hs-4198',
  'sanne.haugen@example.com': 'hs-4199',
  'olivia.petersen@example.com': 'hs-4200',
  'isla.petersen@example.com': 'hs-4201',
  'priya.petersen@example.com': 'hs-4202',
  'sven.vermeer@example.com': 'hs-4203',
  'joris.hart@example.com': 'hs-4204',
  'sara.lindqvist@example.com': 'hs-4205',
  'priya.fontaine@example.com': 'hs-4206',
  'bruno.sorensen@example.com': 'hs-4207',
  'idris.ferreira@example.com': 'hs-4208',
  'noah.brand@example.com': 'hs-4209',
  'ines.okafor@example.com': 'hs-4210',
  'rune.okafor@example.com': 'hs-4211',
  'emil.mensah@example.com': 'hs-4212',
  'lena.novak@example.com': 'hs-4213',
  'lukas.rivera@example.com': 'hs-4214',
  'bo.toft@example.com': 'hs-4215',
  'hugo.halvorsen@example.com': 'hs-4216',
  'sanne.ferreira@example.com': 'hs-4217',
  'tariq.fontaine@example.com': 'hs-4218',
  'hugo.duarte@example.com': 'hs-4219',
  'tariq.tanaka@example.com': 'hs-4220',
  'talia.dubois@example.com': 'hs-4221',
  'mia.keller@example.com': 'hs-4222',
  'theo.molnar@example.com': 'hs-4223',
  'petra.andersen@example.com': 'hs-4224',
  'stefan.costa@example.com': 'hs-4225',
  'marta.sandberg@example.com': 'hs-4226',
  'isla.fontaine@example.com': 'hs-4227',
  'petra.weber@example.com': 'hs-4228',
  'idris.nakamura@example.com': 'hs-4229',
  'mateo.oduya@example.com': 'hs-4230',
  'felix.rivera@example.com': 'hs-4231',
  'bo.ngata@example.com': 'hs-4232',
  'elif.bakker@example.com': 'hs-4233',
  'aleksander.hassan@example.com': 'hs-4234',
  'ida.sorensen@example.com': 'hs-4235',
  'yuki.oduya@example.com': 'hs-4236',
  'dmitri.andersen@example.com': 'hs-4237',
  'diego.nakamura@example.com': 'hs-4238',
  'signe.vermeer@example.com': 'hs-4239',
  'freya.kaplan@example.com': 'hs-4240',
  'viktor.delgado@example.com': 'hs-4241',
  'lukas.blom@example.com': 'hs-4242',
  'isla.brooks@example.com': 'hs-4243',
  'jan.berger@example.com': 'hs-4244',
  'leila.diallo@example.com': 'hs-4245',
  'anya.berger@example.com': 'hs-4246',
  'ethan.haugen@example.com': 'hs-4247',
  'dmitri.mensah@example.com': 'hs-4248',
  'freya.rivera@example.com': 'hs-4249',
  'liam.sorensen@example.com': 'hs-4250',
  'idris.bakker@example.com': 'hs-4251',
  'viktor.diallo@example.com': 'hs-4252',
  'milo.keller@example.com': 'hs-4253',
  'sven.raman@example.com': 'hs-4254',
  'jan.lange@example.com': 'hs-4255',
  'iris.keller@example.com': 'hs-4256',
  'arthur.vos@example.com': 'hs-4257',
  'marta.falk@example.com': 'hs-4258',
  'aya.okafor@example.com': 'hs-4259',
  'ines.haugen@example.com': 'hs-4260',
  'roos.molnar@example.com': 'hs-4261',
  'viktor.aalto@example.com': 'hs-4262',
  'rafael.osei@example.com': 'hs-4263',
  'casper.acheampong@example.com': 'hs-4264',
  'jan.hoffmann@example.com': 'hs-4265',
  'signe.halvorsen@example.com': 'hs-4266',
  'priya.vermeer@example.com': 'hs-4267',
  'kai.gallagher@example.com': 'hs-4268',
  'liam.rossi@example.com': 'hs-4270',
  'maya.jimenez@example.com': 'hs-4271',
  'oscar.bianchi@example.com': 'hs-4272',
  'ines.jimenez@example.com': 'hs-4273',
  'sven.hoffmann@example.com': 'hs-4274',
  'solveig.marchetti@example.com': 'hs-4275',
  'bram.ngata@example.com': 'hs-4276',
  'aya.sandberg@example.com': 'hs-4277',
  'yuki.rivera@example.com': 'hs-4278',
  'elena.moreau@example.com': 'hs-4279',
  'elena.lange@example.com': 'hs-4280',
  'mia.sorensen@example.com': 'hs-4281',
  'maya.acheampong@example.com': 'hs-4282',
  'theo.halvorsen@example.com': 'hs-4283',
  'milo.kaplan@example.com': 'hs-4284',
  'liam.bianchi@example.com': 'hs-4285',
  'aleksander.okonkwo@example.com': 'hs-4286',
  'marco.delgado@example.com': 'hs-4287',
  'casper.whitfield@example.com': 'hs-4288',
  'malik.toft@example.com': 'hs-4289',
  'amara.okafor@example.com': 'hs-4290',
  'bram.halvorsen@example.com': 'hs-4291',
  'dmitri.diallo@example.com': 'hs-4292',
  'iris.nurmi@example.com': 'hs-4293',
  'theo.bakker@example.com': 'hs-4294',
  'hana.keller@example.com': 'hs-4295',
  'ines.acheampong@example.com': 'hs-4296',
  'otto.dubois@example.com': 'hs-4297',
  'bruno.mensah@example.com': 'hs-4298',
  'mattia.tanaka@example.com': 'hs-4299',
  'arthur.oduya@example.com': 'hs-4300',
  'petra.iversen@example.com': 'hs-4301',
  'leila.petersen@example.com': 'hs-4302',
  'jan.silva@example.com': 'hs-4303',
  'rafael.silva@example.com': 'hs-4304',
  'signe.delgado@example.com': 'hs-4305',
  'milo.vermeer@example.com': 'hs-4306',
  'diego.bakker@example.com': 'hs-4307',
  'henrik.aalto@example.com': 'hs-4308',
  'malik.berger@example.com': 'hs-4309',
  'bruno.halvorsen@example.com': 'hs-4310',
  'aya.silva@example.com': 'hs-4311',
  'lena.aalto@example.com': 'hs-4312',
  'kai.tanaka@example.com': 'hs-4313',
  'sanne.mensah@example.com': 'hs-4314',
  'joris.ferreira@example.com': 'hs-4315',
  'lukas.aalto@example.com': 'hs-4316',
  'bruno.larsen@example.com': 'hs-4317',
  'lucia.berger@example.com': 'hs-4318',
  'otto.haugen@example.com': 'hs-4319',
  'leila.molnar@example.com': 'hs-4320',
  'jan.okonkwo@example.com': 'hs-4321',
  'tomas.silva@example.com': 'hs-4322',
  'oscar.hart@example.com': 'hs-4323',
  'arthur.ngata@example.com': 'hs-4324',
  'elif.jimenez@example.com': 'hs-4325',
  'jonas.blom@example.com': 'hs-4326',
  'olivia.hart@example.com': 'hs-4327',
  'liam.rasmussen@example.com': 'hs-4328',
  'yuki.sorensen@example.com': 'hs-4329',
  'diego.rasmussen@example.com': 'hs-4330',
  'jan.tanaka@example.com': 'hs-4331',
  'anders.brand@example.com': 'hs-4332',
  'bruno.jimenez@example.com': 'hs-4333',
  'lukas.marchetti@example.com': 'hs-4334',
  'anders.moreau@example.com': 'hs-4335',
  'kai.sorensen@example.com': 'hs-4336',
  'aya.dubois@example.com': 'hs-4337',
  'sofia.petersen@example.com': 'hs-4338',
  'mia.bakker@example.com': 'hs-4339',
  'rafael.diallo@example.com': 'hs-4340',
  'camille.gallagher@example.com': 'hs-4341',
  'arthur.costa@example.com': 'hs-4342',
  'rafael.bakker@example.com': 'hs-4343',
  'emil.bakker@example.com': 'hs-4344',
  'leila.kowalska@example.com': 'hs-4345',
  'theo.kowalska@example.com': 'hs-4346',
  'priya.falk@example.com': 'hs-4347',
  'rune.sorensen@example.com': 'hs-4348',
  'leila.tanaka@example.com': 'hs-4349',
  'mattia.diallo@example.com': 'hs-4350',
  'aleksander.silva@example.com': 'hs-4351',
  'stefan.silva@example.com': 'hs-4352',
  'ines.dunbar@example.com': 'hs-4353',
  'emil.hart@example.com': 'hs-4354',
  'aya.berger@example.com': 'hs-4355',
  'anya.toft@example.com': 'hs-4356',
  'ava.toft@example.com': 'hs-4357',
  'mia.diallo@example.com': 'hs-4358',
  'isla.oduya@example.com': 'hs-4359',
  'elena.costa@example.com': 'hs-4360',
  'talia.adeyemi@example.com': 'hs-4361',
  'bo.haugen@example.com': 'hs-4362',
  'signe.bakker@example.com': 'hs-4363',
  'mateo.duarte@example.com': 'hs-4364',
  'noah.dunbar@example.com': 'hs-4365',
  'sanne.sorensen@example.com': 'hs-4366',
  'bruno.oduya@example.com': 'hs-4367',
  'greta.okafor@example.com': 'hs-4368',
  'camille.vermeer@example.com': 'hs-4369',
  'idris.andersen@example.com': 'hs-4370',
  'greta.ngata@example.com': 'hs-4371',
  'rune.novak@example.com': 'hs-4372',
  'mia.aalto@example.com': 'hs-4373',
  'mia.osei@example.com': 'hs-4374',
  'bo.kaplan@example.com': 'hs-4375',
  'amelia.whitfield@example.com': 'hs-4376',
  'nils.andersen@example.com': 'hs-4377',
  'anders.grandi@example.com': 'hs-4378',
  'lucia.larsen@example.com': 'hs-4379',
  'lucia.hassan@example.com': 'hs-4380',
  'ida.bakker@example.com': 'hs-4381',
  'priya.grandi@example.com': 'hs-4382',
  'mia.oduya@example.com': 'hs-4383',
  'roos.haugen@example.com': 'hs-4384',
  'hana.larsen@example.com': 'hs-4385',
  'chiara.silva@example.com': 'hs-4386',
  'noah.iversen@example.com': 'hs-4387',
  'malik.moreau@example.com': 'hs-4388',
  'anders.haugen@example.com': 'hs-4389',
  'elena.petersen@example.com': 'hs-4390',
  'zara.grandi@example.com': 'hs-4391',
  'mia.moreau@example.com': 'hs-4392',
  'priya.nurmi@example.com': 'hs-4393',
  'henrik.brooks@example.com': 'hs-4394',
  'casper.sorensen@example.com': 'hs-4395',
  'emil.tanaka@example.com': 'hs-4396',
  'sofia.tanaka@example.com': 'hs-4397',
  'aleksander.nakamura@example.com': 'hs-4398',
  'felix.petersen@example.com': 'hs-4399',
  'anders.bakker@example.com': 'hs-4400',
  'lena.berger@example.com': 'hs-4401',
  'maya.delgado@example.com': 'hs-4402',
  'viktor.dubois@example.com': 'hs-4403',
  'marta.osei@example.com': 'hs-4404',
  'ava.costa@example.com': 'hs-4405',
  'yuki.aalto@example.com': 'hs-4406',
  'malik.sandberg@example.com': 'hs-4407',
  'solveig.molnar@example.com': 'hs-4408',
  'nils.grandi@example.com': 'hs-4409',
  'ethan.adeyemi@example.com': 'hs-4410',
  'idris.ngata@example.com': 'hs-4411',
  'isla.moreau@example.com': 'hs-4412',
  'marco.vermeer@example.com': 'hs-4413',
  'anders.hart@example.com': 'hs-4414',
  'ines.nurmi@example.com': 'hs-4415',
  'roos.sorensen@example.com': 'hs-4416',
  'arthur.vermeer@example.com': 'hs-4417',
  'otto.larsen@example.com': 'hs-4418',
  'bram.hart@example.com': 'hs-4419',
  'felix.whitfield@example.com': 'hs-4420',
  'priya.sorensen@example.com': 'hs-4421',
  'nora.toft@example.com': 'hs-4422',
  'maya.whitfield@example.com': 'hs-4423',
  'jan.larsen@example.com': 'hs-4424',
  'amara.haugen@example.com': 'hs-4425',
  'dmitri.keller@example.com': 'hs-4426',
  'clara.berger@example.com': 'hs-4427',
  'dmitri.iversen@example.com': 'hs-4428',
  'nadia.novak@example.com': 'hs-4429',
  'petra.rasmussen@example.com': 'hs-4430',
  'zara.vermeer@example.com': 'hs-4431',
  'diego.delgado@example.com': 'hs-4432',
  'aya.grandi@example.com': 'hs-4433',
  'emil.halvorsen@example.com': 'hs-4434',
  'solveig.osei@example.com': 'hs-4435',
  'aleksander.aalto@example.com': 'hs-4436',
  'jonas.okonkwo@example.com': 'hs-4437',
  'ava.andersen@example.com': 'hs-4438',
  'amara.dubois@example.com': 'hs-4439',
  'zara.ngata@example.com': 'hs-4441',
  'hana.falk@example.com': 'hs-4442',
  'amelia.kaplan@example.com': 'hs-4443',
  'bruno.petersen@example.com': 'hs-4444',
  'amelia.iversen@example.com': 'hs-4445',
  'elena.jimenez@example.com': 'hs-4446',
  'malik.marchetti@example.com': 'hs-4447',
  'theo.sandberg@example.com': 'hs-4448',
  'aya.petersen@example.com': 'hs-4449',
  'talia.grandi@example.com': 'hs-4450',
  'henrik.mensah@example.com': 'hs-4451',
  'dmitri.weber@example.com': 'hs-4452',
  'marta.diallo@example.com': 'hs-4453',
  'bruno.haugen@example.com': 'hs-4454',
  'zara.mensah@example.com': 'hs-4455',
  'rafael.kowalska@example.com': 'hs-4456',
  'sofia.nakamura@example.com': 'hs-4457',
  'anders.hoffmann@example.com': 'hs-4458',
  'sofia.diallo@example.com': 'hs-4459',
  'nils.kowalska@example.com': 'hs-4460',
  'roos.acheampong@example.com': 'hs-4461',
  'stefan.mensah@example.com': 'hs-4462',
  'leila.costa@example.com': 'hs-4463',
  'malik.costa@example.com': 'hs-4464',
  'nora.rossi@example.com': 'hs-4465',
  'ines.novak@example.com': 'hs-4466',
  'maya.molnar@example.com': 'hs-4467',
  'olivia.novak@example.com': 'hs-4468',
  'aleksander.hart@example.com': 'hs-4469',
  'rafael.falk@example.com': 'hs-4470',
  'mattia.falk@example.com': 'hs-4471',
  'nils.weber@example.com': 'hs-4472',
  'jan.acheampong@example.com': 'hs-4473',
  'henrik.ferreira@example.com': 'hs-4474',
  'sven.marchetti@example.com': 'hs-4475',
  'aya.hart@example.com': 'hs-4476',
  'casper.nurmi@example.com': 'hs-4477',
  'lukas.weber@example.com': 'hs-4478',
  'ethan.jimenez@example.com': 'hs-4479',
  'anouk.andersen@example.com': 'hs-4480',
  'greta.falk@example.com': 'hs-4481',
  'leila.aalto@example.com': 'hs-4482',
  'aya.halvorsen@example.com': 'hs-4483',
  'rune.whitfield@example.com': 'hs-4484',
  'ethan.acheampong@example.com': 'hs-4485',
  'casper.tanaka@example.com': 'hs-4486',
  'ava.hassan@example.com': 'hs-4487',
  'freya.silva@example.com': 'hs-4488',
  'elena.aalto@example.com': 'hs-4489',
  'mia.costa@example.com': 'hs-4490',
  'rune.rasmussen@example.com': 'hs-4491',
  'chiara.jimenez@example.com': 'hs-4492',
  'anouk.dubois@example.com': 'hs-4493',
  'pierre.sandberg@example.com': 'hs-4494',
  'talia.delgado@example.com': 'hs-4495',
  'anders.keller@example.com': 'hs-4496',
  'greta.lange@example.com': 'hs-4497',
  'ethan.mensah@example.com': 'hs-4498',
  'aleksander.adeyemi@example.com': 'hs-4499',
  'rafael.tanaka@example.com': 'hs-4500',
  'rune.ferreira@example.com': 'hs-4501',
  'roos.aalto@example.com': 'hs-4502',
  'hugo.dunbar@example.com': 'hs-4503',
  'solveig.rivera@example.com': 'hs-4504',
  'anouk.toft@example.com': 'hs-4505',
  'viktor.keller@example.com': 'hs-4506',
  'tomas.oduya@example.com': 'hs-4507',
  'maya.iversen@example.com': 'hs-4508',
  'marta.kowalska@example.com': 'hs-4509',
  'zara.rossi@example.com': 'hs-4510',
  'maya.lindgren@example.com': 'hs-4511',
  'elena.novak@example.com': 'hs-4512',
  'liam.dubois@example.com': 'hs-4513',
  'bo.whitfield@example.com': 'hs-4514',
  'rune.falk@example.com': 'hs-4515',
  'anouk.bakker@example.com': 'hs-4516',
  'mateo.rivera@example.com': 'hs-4517',
  'alice.novak@example.com': 'hs-4518',
  'stefan.boyle@example.com': 'hs-4519',
  'tariq.toft@example.com': 'hs-4520',
  'leila.brand@example.com': 'hs-4521',
  'hana.marchetti@example.com': 'hs-4522',
  'chiara.delgado@example.com': 'hs-4523',
  'henrik.rossi@example.com': 'hs-4524',
  'petra.brooks@example.com': 'hs-4525',
  'elif.acheampong@example.com': 'hs-4526',
  'marco.falk@example.com': 'hs-4527',
  'sanne.vermeer@example.com': 'hs-4528',
  'nadia.kowalska@example.com': 'hs-4529',
  'diego.larsen@example.com': 'hs-4530',
  'marco.raman@example.com': 'hs-4531',
  'aya.vos@example.com': 'hs-4532',
  'roos.kowalska@example.com': 'hs-4533',
  'chiara.raman@example.com': 'hs-4534',
  'marta.okonkwo@example.com': 'hs-4535',
  'camille.ferreira@example.com': 'hs-4536',
  'hana.osei@example.com': 'hs-4537',
  'mia.mensah@example.com': 'hs-4538',
  'malik.kaplan@example.com': 'hs-4539',
  'anouk.iversen@example.com': 'hs-4540',
  'mateo.blom@example.com': 'hs-4541',
  'chiara.vos@example.com': 'hs-4542',
  'dmitri.haugen@example.com': 'hs-4543',
  'otto.oduya@example.com': 'hs-4544',
  'bram.lindqvist@example.com': 'hs-4545',
  'anders.sandberg@example.com': 'hs-4546',
  'diego.moreau@example.com': 'hs-4547',
  'marco.bakker@example.com': 'hs-4548',
  'leila.lindgren@example.com': 'hs-4549',
  'clara.silva@example.com': 'hs-4550',
  'anders.novak@example.com': 'hs-4551',
  'pierre.adeyemi@example.com': 'hs-4552',
  'nadia.okafor@example.com': 'hs-4553',
  'casper.kowalska@example.com': 'hs-4554',
  'liam.halvorsen@example.com': 'hs-4555',
  'sofia.hoffmann@example.com': 'hs-4556',
  'stefan.raman@example.com': 'hs-4557',
  'alice.dubois@example.com': 'hs-4558',
};

/**
 * `role` gates approving; `team` addresses work. They are separate axes on
 * purpose — Maya approves sends AND writes delay copy, Jakob does neither,
 * and collapsing the two would make one of those people impossible.
 */
export const USERS = [
  {
    id: 'user-tom',
    name: 'Tom Lloyd',
    email: 'tom.lloyd@avantarte.com',
    role: 'admin' as const,
    team: 'ops' as const,
  },
  {
    id: 'user-crm',
    name: 'Maya Delacroix',
    email: 'maya.delacroix@avantarte.com',
    role: 'admin' as const,
    team: 'crm' as const,
  },
  {
    id: 'user-crm-2',
    name: 'Nadia Ferreira',
    email: 'nadia.ferreira@avantarte.com',
    role: 'operator' as const,
    team: 'crm' as const,
  },
  {
    id: 'user-pm',
    name: 'Priya Nair',
    email: 'priya.nair@avantarte.com',
    role: 'operator' as const,
    team: 'ops' as const,
  },
  {
    id: 'user-warehouse',
    name: 'Jakob Meijer',
    email: 'jakob.meijer@avantarte.com',
    role: 'operator' as const,
    team: 'ops' as const,
  },
];
