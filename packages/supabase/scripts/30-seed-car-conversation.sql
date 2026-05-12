-- ============================================================================
--  DEMO / TEST SEED — NOT FOR PRODUCTION
-- ============================================================================
--
--  Purpose:
--    Populate a channel with 250 realistic chat messages between 4 fake users
--    (alice / bob / carol / dave) discussing the car industry and innovation.
--    Used to stress-test the chatroom's scroll-anchor, pagination, and
--    grouping behavior with enough history to exercise 12+ older pages.
--
--  Idempotent:
--    All inserts use deterministic IDs and ON CONFLICT DO NOTHING, so the
--    script can be re-run safely without producing duplicates.
--
--  Target channel:
--    Change the :channel_id below to seed into any channel. The default is
--    the local-stack test channel. Run with psql — the \set directive is a
--    psql variable, not portable SQL.
--
--  Run:
--    psql -h localhost -p 54322 -U postgres -d postgres \
--         -f packages/supabase/scripts/30-seed-car-conversation.sql
--
--  WARNING:
--    Do NOT run against production. The 4 auth.users rows have well-known
--    UUIDs and weak seed passwords — they exist to make local development
--    realistic, not as real accounts.
-- ============================================================================

\set channel_id 3xPKWD69c42fc1G6

begin;

-- 1. auth.users (FK target for public.users.id)
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  is_super_admin, is_anonymous, is_sso_user
) values
  ('00000000-0000-0000-0000-000000000000'::uuid,
   '11111111-1111-1111-1111-111111111111'::uuid,
   'authenticated', 'authenticated', 'alice.seed@test.local',
   crypt('seed-password-alice', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"username":"alice","full_name":"Alice Chen"}'::jsonb,
   now(), now(), false, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid,
   '22222222-2222-2222-2222-222222222222'::uuid,
   'authenticated', 'authenticated', 'bob.seed@test.local',
   crypt('seed-password-bob', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"username":"bob","full_name":"Bob Reyes"}'::jsonb,
   now(), now(), false, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid,
   '33333333-3333-3333-3333-333333333333'::uuid,
   'authenticated', 'authenticated', 'carol.seed@test.local',
   crypt('seed-password-carol', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"username":"carol","full_name":"Carol Park"}'::jsonb,
   now(), now(), false, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid,
   '44444444-4444-4444-4444-444444444444'::uuid,
   'authenticated', 'authenticated', 'dave.seed@test.local',
   crypt('seed-password-dave', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"username":"dave","full_name":"Dave Okafor"}'::jsonb,
   now(), now(), false, false, false)
on conflict (id) do nothing;

-- 2. public.users
insert into public.users (id, username, email, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'alice', 'alice.seed@test.local', 'Alice Chen'),
  ('22222222-2222-2222-2222-222222222222', 'bob',   'bob.seed@test.local',   'Bob Reyes'),
  ('33333333-3333-3333-3333-333333333333', 'carol', 'carol.seed@test.local', 'Carol Park'),
  ('44444444-4444-4444-4444-444444444444', 'dave',  'dave.seed@test.local',  'Dave Okafor')
on conflict (id) do nothing;

-- 3. channel membership — use NOT EXISTS instead of ON CONFLICT because a
-- BEFORE-INSERT trigger (prevent_duplicate_channel_member) raises before
-- conflict resolution can run.
insert into public.channel_members (channel_id, member_id, channel_member_role)
select v.channel_id, v.member_id::uuid, 'MEMBER'::channel_member_role
from (values
  (:'channel_id', '11111111-1111-1111-1111-111111111111'),
  (:'channel_id', '22222222-2222-2222-2222-222222222222'),
  (:'channel_id', '33333333-3333-3333-3333-333333333333'),
  (:'channel_id', '44444444-4444-4444-4444-444444444444')
) as v(channel_id, member_id)
where not exists (
  select 1 from public.channel_members cm
  where cm.channel_id = v.channel_id and cm.member_id = v.member_id::uuid
);

-- 4. 120 messages — coherent conversation about EVs, batteries, autonomy,
-- manufacturing, design, future. 45s between messages. Deterministic UUIDs
-- via md5 of the seed key so re-runs are idempotent.
with conv(idx, author, body) as (values
  (1,   'alice', 'Did anyone see the Q1 EV market share numbers?'),
  (2,   'bob',   'Yeah, 18% globally. China alone is at 31%.'),
  (3,   'carol', 'Supply chains aren''t ready for that growth. Battery raw materials are tight.'),
  (4,   'dave',  'The bigger question is what these cars feel like to drive. Not what''s under the hood.'),
  (5,   'alice', 'Fair, but the under-the-hood part determines the experience.'),
  (6,   'bob',   'Solid-state batteries change everything. 10-min charge, 800-mile range.'),
  (7,   'carol', 'If we ever ship them at scale.'),
  (8,   'dave',  'Toyota promised 2027, then 2028, now 2030.'),
  (9,   'alice', 'It''s always five years away.'),
  (10,  'bob',   'Honestly the LFP/NMC split is more interesting near-term.'),
  (11,  'carol', 'LFP is winning the volume game.'),
  (12,  'alice', 'Tesla switched their standard Model 3 to LFP back in 2022.'),
  (13,  'dave',  'Customers don''t care about chemistry. They care about range and price.'),
  (14,  'bob',   'Range anxiety is mostly cured below $40k now.'),
  (15,  'carol', 'Charging infrastructure is still the blocker in most of the US.'),
  (16,  'alice', 'Texas added 380 fast chargers in Q1 alone.'),
  (17,  'dave',  'Yeah but the UX at a charger is still terrible compared to a gas pump.'),
  (18,  'bob',   'What''s terrible about it?'),
  (19,  'dave',  'Inconsistent UX, broken screens, payment friction. Tesla still leads here.'),
  (20,  'carol', 'Tesla is vertical. Hard to replicate.'),
  (21,  'alice', 'Speaking of vertical, BYD makes their own chips, motors, batteries.'),
  (22,  'bob',   'And they''re cheaper than Tesla per kWh.'),
  (23,  'carol', 'Half the cost in some cells.'),
  (24,  'dave',  'Their interiors look 5 years behind though.'),
  (25,  'alice', 'Newer models have caught up. Have you seen the Seal?'),
  (26,  'dave',  'Looks like a Tesla Model 3. That''s not original.'),
  (27,  'bob',   'Original or not, the value prop is wild.'),
  (28,  'carol', 'Supply chain advantage. Lithium contracts since 2019.'),
  (29,  'alice', 'While Western OEMs were still pretending hydrogen was viable.'),
  (30,  'bob',   'Hydrogen is interesting for trucking and shipping. Not passenger cars.'),
  (31,  'dave',  'Toyota is doubling down on hydrogen Mirai.'),
  (32,  'carol', 'And selling, what, 2000 a year?'),
  (33,  'alice', 'It''s a hedge bet at best.'),
  (34,  'bob',   'Solid-state may save Toyota.'),
  (35,  'carol', 'If they execute.'),
  (36,  'dave',  'What about autonomous? FSD v13 is supposedly good.'),
  (37,  'alice', 'Tesla''s data moat is huge. Billions of real-world miles.'),
  (38,  'bob',   'Vision-only is a strong bet though risky.'),
  (39,  'carol', 'Waymo and Cruise spent a decade on LiDAR. Hard to write off.'),
  (40,  'dave',  'Waymo is operational in 5 cities now.'),
  (41,  'alice', 'And losing money in every one.'),
  (42,  'bob',   'It''ll scale eventually.'),
  (43,  'carol', 'Maybe. Regulatory is the killer.'),
  (44,  'dave',  'California is open. Texas is open. The rest are slow.'),
  (45,  'alice', 'Europe is years behind on autonomous regulation.'),
  (46,  'bob',   'European OEMs aren''t pushing it though.'),
  (47,  'carol', 'BMW and Mercedes have Level 3 in production.'),
  (48,  'dave',  'Level 3 is barely useful. Hands on the wheel, eyes on the road.'),
  (49,  'alice', 'It''s a stepping stone.'),
  (50,  'bob',   'Level 4 is the only one that matters commercially.'),
  (51,  'carol', 'Robotaxi economics only work at Level 4+.'),
  (52,  'dave',  'And the unit economics aren''t proven yet.'),
  (53,  'alice', 'Cruise burned through $8B with nothing to show.'),
  (54,  'bob',   'GM killed Cruise after that. Smart move.'),
  (55,  'carol', 'They underestimated edge cases.'),
  (56,  'dave',  'Edge cases are the entire game in autonomous.'),
  (57,  'alice', 'Long tail of weird scenarios. Humans handle them effortlessly.'),
  (58,  'bob',   'Until they don''t. 40k US road deaths per year.'),
  (59,  'carol', 'Most are avoidable with even basic ADAS.'),
  (60,  'dave',  'AEB should be mandatory.'),
  (61,  'alice', 'EU made it mandatory in 2024.'),
  (62,  'bob',   'US lagging again.'),
  (63,  'carol', 'Politically charged. Regulatory capture.'),
  (64,  'dave',  'Switch topics — what''s the manufacturing story?'),
  (65,  'alice', 'Tesla''s gigacasting changed everything.'),
  (66,  'bob',   'Single-piece rear underbody. 70 parts down to 1.'),
  (67,  'carol', 'And requires 6000-ton presses. Capital intensive.'),
  (68,  'dave',  'Idra makes 9000-ton ones now.'),
  (69,  'alice', 'Toyota and Honda are copying the approach.'),
  (70,  'bob',   'Costs them years to retool.'),
  (71,  'carol', 'Existing factories were built for stamping, not casting.'),
  (72,  'dave',  'Greenfield is the answer.'),
  (73,  'alice', 'Tesla Berlin is fully gigacast. BYD has 5 plants doing it.'),
  (74,  'bob',   'Massive deltas in piece economics.'),
  (75,  'carol', 'And huge concentration risk.'),
  (76,  'dave',  'Casting defect = scrap a $30k unibody.'),
  (77,  'alice', 'Versus a $200 stamping.'),
  (78,  'bob',   'Yield is everything in casting.'),
  (79,  'carol', 'Tesla had brutal yields early. Reportedly better now.'),
  (80,  'dave',  'BYD claims 95% on launch.'),
  (81,  'alice', 'Believable given their chemistry experience.'),
  (82,  'bob',   'Speaking of, the 4680 cell ramp is supposedly painful.'),
  (83,  'carol', 'Dry electrode process is unproven at scale.'),
  (84,  'dave',  'And every other OEM is doing 2170 instead.'),
  (85,  'alice', 'Until the format converges, every supplier is hedging.'),
  (86,  'bob',   'Format wars in batteries. VHS vs Betamax all over again.'),
  (87,  'carol', 'Or USB-C vs Lightning.'),
  (88,  'dave',  'Lightning lost.'),
  (89,  'alice', 'Eventually. After regulation.'),
  (90,  'bob',   'EU forced USB-C. Battery format will be the same.'),
  (91,  'carol', 'Hope so. Otherwise recycling is a nightmare.'),
  (92,  'dave',  'Battery recycling is the next big story.'),
  (93,  'alice', 'Redwood Materials is the bet.'),
  (94,  'bob',   'JB Straubel is brilliant.'),
  (95,  'carol', 'Closed-loop is the only sustainable path.'),
  (96,  'dave',  'And cobalt-free chemistries are accelerating.'),
  (97,  'alice', 'LFP needs no cobalt. Sodium-ion needs no lithium.'),
  (98,  'bob',   'Sodium energy density is half though.'),
  (99,  'carol', 'Fine for grid storage. Not cars.'),
  (100, 'dave',  'Different segments, different chemistries. Makes sense.'),
  (101, 'alice', 'Let''s talk design. What''s exciting?'),
  (102, 'bob',   'Rivian''s interior. Best-in-class.'),
  (103, 'carol', 'And expensive to build.'),
  (104, 'dave',  'Form follows manufacturing in EVs. Skateboard platforms enable new shapes.'),
  (105, 'alice', 'Frunks, flat floors, completely customizable interiors.'),
  (106, 'bob',   'And the death of the dashboard as we know it.'),
  (107, 'carol', 'Touch-only interfaces are a UX regression though.'),
  (108, 'dave',  'Volume knob is sacred.'),
  (109, 'alice', 'Mazda gets this. Knobs and dials in the right places.'),
  (110, 'bob',   'Tesla minimalism went too far.'),
  (111, 'carol', 'Newer models walked some of it back.'),
  (112, 'dave',  'Stalks coming back.'),
  (113, 'alice', 'After they tried capacitive buttons. Lol.'),
  (114, 'bob',   'Cost cutting disguised as design.'),
  (115, 'carol', 'Always.'),
  (116, 'dave',  'Last thought — what''s the 10-year vision?'),
  (117, 'alice', 'Software-defined cars. OEMs as platforms.'),
  (118, 'bob',   'Or OEMs as commodities and Apple/Google as platforms.'),
  (119, 'carol', 'Apple killed Project Titan.'),
  (120, 'dave',  'Tells you something about how hard cars actually are.'),
  -- Continuation: software ecosystems, V2G, used market, geopolitics, niche players, OTA.
  (121, 'alice', 'So if cars become platforms, who owns the OS?'),
  (122, 'bob',   'Tesla has theirs. VW spent billions on CARIAD.'),
  (123, 'carol', 'CARIAD was a disaster. Two years late, billions over budget.'),
  (124, 'dave',  'Software is genuinely hard for legacy automakers.'),
  (125, 'alice', 'GM canceled Apple CarPlay support. Bold or foolish?'),
  (126, 'bob',   'Bold. They want to own the in-car experience.'),
  (127, 'dave',  'Customers hated the decision.'),
  (128, 'carol', 'Drove buyers away. Survey after survey shows it.'),
  (129, 'alice', 'Or CarPlay/Android Auto become commoditized.'),
  (130, 'bob',   'Like phones. iOS vs Android — that''s the duopoly.'),
  (131, 'carol', 'Maps and navigation alone is huge leverage.'),
  (132, 'dave',  'Google Maps owns navigation. Nobody''s close.'),
  (133, 'alice', 'Tesla rolled their own. Mediocre at best.'),
  (134, 'bob',   'But EV-aware routing with charging stops is unique.'),
  (135, 'carol', 'Apple and Google haven''t cracked that.'),
  (136, 'dave',  'ABRP works, but the UX is clunky.'),
  (137, 'alice', 'ABRP is mostly a community project.'),
  (138, 'bob',   'EV charging-stop planning is the killer feature.'),
  (139, 'carol', 'Weather-aware routing matters too.'),
  (140, 'dave',  'Range estimate accuracy beats peak range for daily trust.'),
  (141, 'alice', 'Nothing kills trust like a dropped 50 miles mid-trip.'),
  (142, 'bob',   'Tesla''s estimate gets within 5% most days.'),
  (143, 'carol', 'For ICE that''d be unremarkable. For EVs it''s impressive.'),
  (144, 'dave',  'EV-specific apps are still primitive.'),
  (145, 'alice', 'ChargePoint and Plugshare are decent but limited.'),
  (146, 'bob',   'Fragmented per network. No unified standard.'),
  (147, 'carol', 'Like gas stations except worse UX.'),
  (148, 'dave',  'Plug-and-charge is finally arriving.'),
  (149, 'alice', 'ISO 15118 is the standard.'),
  (150, 'bob',   'Only fully deployed in Europe right now.'),
  (151, 'carol', 'V2G is real now. Bidirectional charging in production.'),
  (152, 'dave',  'F-150 Lightning powers houses during outages.'),
  (153, 'alice', 'Three days off a full pack. That''s wild.'),
  (154, 'bob',   'Huge resilience play.'),
  (155, 'carol', '100M EVs as a distributed battery is the long-term dream.'),
  (156, 'dave',  'Utilities are wary. They prefer central control.'),
  (157, 'alice', 'PG&E in California is partnering. Slowly.'),
  (158, 'bob',   'Some pilots pay drivers for discharge during peak.'),
  (159, 'carol', 'Economic incentive matters. Make it pay.'),
  (160, 'dave',  'Battery degradation from V2G is the concern.'),
  (161, 'alice', 'Cycles count. Whether driving or feeding the grid.'),
  (162, 'bob',   'But LFP handles 6000+ cycles. Plenty of margin.'),
  (163, 'carol', 'Pack chemistry matters more than V2G exposure.'),
  (164, 'dave',  'Thermal management is huge too.'),
  (165, 'alice', 'Tesla packs run cooler than most.'),
  (166, 'bob',   'Heat is the real killer for battery life.'),
  (167, 'carol', 'Phoenix and Dubai will tell us a lot in 5 years.'),
  (168, 'dave',  'Arizona Model 3s already publishing data.'),
  (169, 'alice', '90% retention after 100k miles in hot climates.'),
  (170, 'bob',   'Great in aggregate. Outliers always exist.'),
  (171, 'carol', 'Used EV market is finally maturing.'),
  (172, 'dave',  'Model S from 2014 still does 250+ miles.'),
  (173, 'alice', 'Tesla had real quality issues early.'),
  (174, 'bob',   'Touchscreen failures and MCU replacements.'),
  (175, 'carol', '$5k out of warranty. Painful.'),
  (176, 'dave',  'Most other EVs are too new to have used-market data.'),
  (177, 'alice', 'Bolt is the exception. Recall destroyed resale.'),
  (178, 'bob',   '$1B in battery recalls. GM ate the cost.'),
  (179, 'carol', 'They killed the Bolt name. Coming back as Equinox EV.'),
  (180, 'dave',  'Hiding history with rebrands. Classic move.'),
  (181, 'alice', 'Insurance is its own story.'),
  (182, 'bob',   'EVs cost more to insure. Tesla particularly.'),
  (183, 'carol', 'Repair cost is the driver.'),
  (184, 'dave',  'Gigacasting plus one fender bender = total loss.'),
  (185, 'alice', 'Tesla Insurance is vertically integrating that too.'),
  (186, 'bob',   'Real-time driving data feeds premiums.'),
  (187, 'carol', 'Privacy concerns are non-trivial.'),
  (188, 'dave',  'EULA culture. Same as smartphones.'),
  (189, 'alice', 'Dealer model is dying for EVs.'),
  (190, 'bob',   'Tesla bypass set the template.'),
  (191, 'carol', 'Direct sales blocked in many US states still.'),
  (192, 'dave',  'Franchise laws are ancient and protectionist.'),
  (193, 'alice', 'Dealers are politically powerful in state houses.'),
  (194, 'bob',   'Every state legislature has dealer money.'),
  (195, 'carol', 'Rivian and Lucid fighting state by state.'),
  (196, 'dave',  'Dumb. Customers want online buying.'),
  (197, 'alice', 'OTA updates make dealer service less relevant anyway.'),
  (198, 'bob',   'Bodywork and tires still need shops though.'),
  (199, 'carol', 'But most routine service goes away with EVs.'),
  (200, 'dave',  '60% fewer moving parts. Less to break.'),
  (201, 'alice', 'Geopolitics is dominating the conversation now.'),
  (202, 'bob',   'US tariffs jumped to 100% on Chinese EVs.'),
  (203, 'carol', 'Effective ban at that level.'),
  (204, 'dave',  'EU went to 38%. Less brutal but still a wall.'),
  (205, 'alice', 'Counter-productive long-term.'),
  (206, 'bob',   'Protects domestic industry short-term though.'),
  (207, 'carol', 'Chinese OEMs are building in Mexico, Hungary, Thailand.'),
  (208, 'dave',  'BYD Hungary plant just opened. More coming.'),
  (209, 'alice', 'Tariff arbitrage via friend-shoring.'),
  (210, 'bob',   'Free trade is effectively dead.'),
  (211, 'carol', 'Industrial policy is back everywhere.'),
  (212, 'dave',  'CHIPS Act for semis. IRA for batteries.'),
  (213, 'alice', 'Subsidies are the new normal.'),
  (214, 'bob',   'Distortionary, but here to stay.'),
  (215, 'carol', 'Rare earths and lithium are strategic now.'),
  (216, 'dave',  'Indonesia controls 60% of nickel reserves.'),
  (217, 'alice', 'Chile and Australia for lithium.'),
  (218, 'bob',   'DRC for cobalt — politically a mess.'),
  (219, 'carol', 'Ethical sourcing is mostly marketing right now.'),
  (220, 'dave',  'Traceability improving, slowly.'),
  (221, 'alice', 'Niche players. Lucid, Polestar, Rivian.'),
  (222, 'bob',   'Lucid has the best tech and the worst sales.'),
  (223, 'carol', '$250k Air Sapphire is engineering theater.'),
  (224, 'dave',  'Polestar is in a rough patch.'),
  (225, 'alice', 'Volvo dropped them. Geely picking up the slack.'),
  (226, 'bob',   'Tough segment between Tesla and legacy luxury.'),
  (227, 'carol', 'Lucid had Saudi PIF money. Almost out by some accounts.'),
  (228, 'dave',  'Rivian losing $40k per truck on each unit.'),
  (229, 'alice', 'But the $5B Amazon van order saves them.'),
  (230, 'bob',   'Vans are different. Commercial buyers care about TCO.'),
  (231, 'carol', 'And fleet economics work for EVs already.'),
  (232, 'dave',  'OTA updates story. Best in class?'),
  (233, 'alice', 'Tesla. Years ahead of everyone.'),
  (234, 'bob',   'Rivian added bidirectional charging via OTA after launch.'),
  (235, 'carol', 'Gained 30 miles of range mid-cycle via update.'),
  (236, 'dave',  'Legacy OEMs still need dealer visits for ECU updates.'),
  (237, 'alice', 'Ford and GM improving, but slowly.'),
  (238, 'bob',   'VW ID series had OTA at launch and broke half the cars.'),
  (239, 'carol', 'Testing was insufficient.'),
  (240, 'dave',  'Software-defined cars demand software-grade testing.'),
  (241, 'alice', 'Most automakers don''t have that culture or staffing.'),
  (242, 'bob',   'Subscription features. Yay or nay?'),
  (243, 'carol', 'BMW tried heated seats subscription. Backlash was brutal.'),
  (244, 'dave',  'Withdrawn after six months.'),
  (245, 'alice', 'Customers feel hardware they paid for is theirs.'),
  (246, 'bob',   'Tesla''s FSD subscription is $99/mo though.'),
  (247, 'carol', 'Difference: software functionality, not hardware lockout.'),
  (248, 'dave',  'Fair distinction. People accept software-as-a-service.'),
  (249, 'alice', 'Overall — optimistic or pessimistic on auto?'),
  (250, 'bob',   'Optimistic on innovation. Pessimistic on legacy OEM survival.')
), users_map(name, id) as (values
  ('alice', '11111111-1111-1111-1111-111111111111'::uuid),
  ('bob',   '22222222-2222-2222-2222-222222222222'::uuid),
  ('carol', '33333333-3333-3333-3333-333333333333'::uuid),
  ('dave',  '44444444-4444-4444-4444-444444444444'::uuid)
)
insert into public.messages (id, content, html, user_id, channel_id, created_at, updated_at, type)
select
  -- Deterministic id from (channel_id, idx) so re-runs are idempotent AND
  -- the same conversation can be seeded into multiple channels without
  -- colliding on message UUIDs.
  md5('seed-car-conv-' || :'channel_id' || '-' || c.idx)::uuid,
  c.body,
  '<p>' || c.body || '</p>',
  u.id,
  :'channel_id',
  '2026-05-01 10:00:00 UTC'::timestamptz + (c.idx - 1) * interval '45 seconds',
  '2026-05-01 10:00:00 UTC'::timestamptz + (c.idx - 1) * interval '45 seconds',
  'text'::message_type
from conv c
join users_map u on u.name = c.author
on conflict (id) do nothing;

commit;
