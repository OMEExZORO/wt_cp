INSERT INTO branches (slug, name, address_line, landmark, area, city, state, postal_code, is_placeholder, is_active, sort_order)
VALUES
    ('bhosari', 'MDC Bhosari', 'Nagdev Tower, Pune Nashik Road', 'Near Vishwavilas Hotel and Shraddha Jewellers', 'Bhosari', 'Pune', 'Maharashtra', '411039', TRUE, TRUE, 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO scan_categories (parent_id, slug, modality, name, tagline, description, sort_order)
VALUES
    (NULL, 'ultrasound', 'USG', 'Ultrasound (USG)', 'Safe, Non-invasive, Highly accurate', 'Ultrasound uses sound waves to create live pictures of organs, blood flow and soft tissues. It does not use X-ray radiation.', 1),
    (NULL, 'ct', 'CT', 'Computed Tomography (CT)', 'Detailed, Fast, Low-dose technology', 'CT uses X-rays and a computer to create detailed cross-sectional images of the body. The scan itself is quick and painless.', 2),
    (NULL, 'image-guided-biopsies', 'BIOPSY', 'Image-Guided Biopsies', 'Precise, Safe, Minimally invasive', 'A small tissue or fluid sample is taken with a needle while ultrasound or CT shows the exact position, so the needle reaches the right spot.', 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO scan_categories (parent_id, slug, modality, name, description, sort_order)
SELECT parent.id, child.slug, child.modality, child.name, child.description, child.sort_order
FROM (
    VALUES
        ('ultrasound', 'usg-obstetrics', 'USG', 'Obstetrics', 'Pregnancy scans to check the health, growth and wellbeing of the baby and the pregnancy.', 1),
        ('ultrasound', 'usg-gynecology', 'USG', 'Gynecology', 'Scans of the uterus, ovaries and pelvis.', 2),
        ('ultrasound', 'usg-general-specialized', 'USG', 'General and Specialized', 'Scans of the abdomen, neck, breast, joints, blood vessels and other body parts for adults and children.', 3),
        ('ultrasound', 'usg-prostate-imaging', 'USG', 'Prostate Imaging', 'Detailed imaging of the prostate gland and guided prostate procedures.', 4),
        ('image-guided-biopsies', 'biopsy-usg-guided', 'BIOPSY', 'USG Guided', 'Biopsies and drainage procedures guided by live ultrasound.', 1),
        ('image-guided-biopsies', 'biopsy-ct-guided', 'BIOPSY', 'CT Guided', 'Biopsies and drainage procedures for deeper areas, guided by CT images.', 2)
) AS child (parent_slug, slug, modality, name, description, sort_order)
JOIN scan_categories parent ON parent.slug = child.parent_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO scan_types (category_id, slug, modality, name, short_description, preparation_tips, duration_minutes, sort_order)
SELECT category.id, item.slug, category.modality, item.name, item.short_description, item.preparation_tips, item.duration_minutes, item.sort_order
FROM (
    VALUES
        ('usg-obstetrics', 'early-pregnancy-scan', 'Early Pregnancy Scan', 'An early scan to confirm the pregnancy, its location in the uterus and the presence of a heartbeat.', 'Your doctor may ask you to come with a comfortably full bladder or the scan may be done transvaginally. Bring any previous pregnancy test or scan reports and your doctor''s referral.', 20, 1),
        ('usg-obstetrics', 'dating-scan', 'Dating Scan', 'Measures the baby to estimate how many weeks pregnant you are and the expected due date.', 'Drink water as advised so that your bladder is comfortably full. Bring previous scan reports and know the first day of your last menstrual period.', 20, 2),
        ('usg-obstetrics', 'nt-scan', 'NT Scan', 'A scan done in a specific early window of pregnancy, as advised by your obstetrician, that measures the fluid at the back of the baby''s neck as part of screening.', 'Book within the week range your obstetrician has advised. Eat normally. Bring previous scan reports and any blood test reports requested for combined screening.', 30, 3),
        ('usg-obstetrics', 'anomaly-scan', 'Anomaly Scan', 'A detailed mid-pregnancy scan that looks at the baby''s organs and structure.', 'Book at the time recommended by your obstetrician. Eat and drink normally. The scan can take longer than routine scans, so allow extra time. Bring previous scan reports.', 40, 4),
        ('usg-obstetrics', 'growth-scan', 'Growth Scan', 'Checks the baby''s size and growth, the fluid around the baby and the position of the placenta.', 'No special preparation is usually needed. Eat and drink normally and bring all previous pregnancy scan reports so growth can be compared.', 20, 5),
        ('usg-obstetrics', 'doppler-studies-fetal-placental', 'Doppler Studies (Fetal and Placental)', 'Measures blood flow in the baby''s and placenta''s blood vessels to check that the baby is receiving enough supply.', 'No special preparation is usually needed. Bring previous scan reports and your obstetrician''s referral.', 30, 6),
        ('usg-obstetrics', 'amniotic-fluid-assessment', 'Amniotic Fluid Assessment', 'Measures the amount of fluid around the baby.', 'No special preparation is usually needed. Bring previous scan reports.', 15, 7),
        ('usg-obstetrics', 'placental-localization', 'Placental Localization', 'Shows where the placenta is placed in the uterus.', 'A comfortably full bladder may be requested. Bring previous scan reports.', 15, 8),
        ('usg-gynecology', 'pelvic-usg-transabdominal', 'Pelvic USG (Transabdominal)', 'A scan of the uterus and ovaries performed over the lower abdomen.', 'Come with a full bladder: drink about four to five glasses of water roughly one hour before the scan and do not pass urine until the scan is done, unless the centre advises otherwise.', 20, 1),
        ('usg-gynecology', 'transvaginal-usg-tvs', 'Transvaginal USG (TVS)', 'An internal scan using a thin, covered probe that gives clearer pictures of the uterus and ovaries.', 'Empty your bladder before the scan. The procedure will be explained and your consent taken first. You may ask for a female attendant to be present.', 20, 2),
        ('usg-gynecology', 'follicular-monitoring', 'Follicular Monitoring', 'A series of scans that track the growth of egg follicles in the ovaries, usually during fertility treatment.', 'Follow the day-of-cycle schedule given by your fertility doctor. These scans are often transvaginal, so empty your bladder before each visit. Bring previous follicular study records.', 15, 3),
        ('usg-gynecology', 'pcos-evaluation', 'PCOS Evaluation', 'A scan of the ovaries and uterus to look for features associated with polycystic ovary syndrome.', 'Your doctor may advise a particular day of your cycle. Come with a full bladder for a transabdominal scan, or an empty bladder if a transvaginal scan is planned.', 20, 4),
        ('usg-general-specialized', 'whole-abdomen', 'Whole Abdomen', 'A scan of the liver, gallbladder, pancreas, spleen, kidneys, bladder and other abdominal organs.', 'Do not eat for about six hours before the scan; plain water is usually allowed. Come with a comfortably full bladder. Take regular medicines unless your doctor advises otherwise.', 20, 1),
        ('usg-general-specialized', 'renal-urinary-tract', 'Renal and Urinary Tract', 'A scan of the kidneys, ureters and urinary bladder.', 'Drink water before the scan so that your bladder is comfortably full. Bring previous reports.', 20, 2),
        ('usg-general-specialized', 'liver-gallbladder-biliary', 'Liver / Gallbladder / Biliary System', 'A focused scan of the liver, gallbladder and bile ducts.', 'Do not eat for about six hours before the scan so that the gallbladder is visible clearly. Plain water is usually allowed.', 20, 3),
        ('usg-general-specialized', 'pancreas-spleen', 'Pancreas and Spleen', 'A focused scan of the pancreas and spleen.', 'Do not eat for about six hours before the scan. Plain water is usually allowed.', 20, 4),
        ('usg-general-specialized', 'thyroid', 'Thyroid', 'A scan of the thyroid gland in the neck to look at its size and any nodules.', 'No special preparation is needed. Wear a top that leaves the neck easy to reach and remove necklaces. Bring thyroid blood test reports if available.', 15, 5),
        ('usg-general-specialized', 'breast', 'Breast', 'A scan of the breast tissue, often used to look more closely at a lump or alongside mammography.', 'No special preparation is needed. Avoid applying powder or lotion on the chest that day. Bring previous breast imaging reports.', 20, 6),
        ('usg-general-specialized', 'scrotum-testis', 'Scrotum and Testis', 'A scan of the testes and surrounding structures.', 'No special preparation is needed. A male attendant can be requested.', 15, 7),
        ('usg-general-specialized', 'musculoskeletal', 'Musculoskeletal (Joints, Tendons, Soft Tissues)', 'A scan of joints, tendons, muscles and soft tissue swellings.', 'No special preparation is needed. Wear loose clothing that allows the area to be uncovered easily.', 20, 8),
        ('usg-general-specialized', 'vascular-doppler', 'Vascular Doppler (Arterial and Venous)', 'Uses Doppler ultrasound to check blood flow in the arteries and veins, for example of the legs or neck.', 'No special preparation is usually needed. Wear loose clothing. The scan can take some time depending on the vessels studied.', 40, 9),
        ('usg-general-specialized', 'small-parts', 'Small Parts (Salivary Glands, Neck, etc.)', 'A scan of small superficial structures such as the salivary glands and lumps in the neck.', 'No special preparation is needed. Remove jewellery from the area being scanned.', 15, 10),
        ('usg-general-specialized', 'pediatric-usg', 'Pediatric USG', 'Ultrasound scans for infants and children, which are painless and use no radiation.', 'Preparation depends on the body part being scanned; the centre will advise you. Bring a feed, toy or comfort item for small children and a parent should accompany the child.', 20, 11),
        ('usg-prostate-imaging', 'trus', 'Transrectal Ultrasound (TRUS)', 'A detailed scan of the prostate using a thin, covered probe placed in the rectum, used for prostate evaluation and guided procedures.', 'Follow any bowel preparation advised by the centre. Tell the staff if you take blood thinners. The procedure will be explained and your consent taken first.', 30, 1),
        ('ct', 'ct-brain', 'CT Brain', 'A CT scan of the head and brain.', 'Usually no preparation for a plain scan. If contrast is planned, you may be asked not to eat for about four hours. Remove hairpins and metal items from the head.', 15, 1),
        ('ct', 'ct-pns', 'CT PNS (Sinuses)', 'A CT scan of the sinuses around the nose.', 'No special preparation is usually needed. Remove spectacles, earrings and hairpins.', 15, 2),
        ('ct', 'ct-neck', 'CT Neck', 'A CT scan of the structures in the neck.', 'If contrast is planned, you may be asked not to eat for about four hours. Remove necklaces and earrings.', 15, 3),
        ('ct', 'ct-orbit', 'CT Orbit', 'A CT scan of the eye sockets and surrounding bones.', 'No special preparation is usually needed. Remove eye make-up, spectacles and any metal items from the head.', 15, 4),
        ('ct', 'ct-temporal-bone', 'CT Temporal Bone', 'A detailed CT scan of the ear and the bone around it.', 'No special preparation is usually needed. Remove hearing aids, earrings and hairpins.', 15, 5),
        ('ct', 'ct-3d-face', 'CT 3D Face', 'A CT scan of the facial bones with three-dimensional reconstruction.', 'No special preparation is usually needed. Remove jewellery, spectacles and removable dentures if asked.', 15, 6),
        ('ct', 'ct-thorax', 'CT Thorax (Lungs)', 'A CT scan of the chest including the lungs, heart outline and chest wall.', 'If contrast is planned, you may be asked not to eat for about four hours. Bring previous chest X-rays and CT reports.', 15, 7),
        ('ct', 'ct-abdomen-pelvis', 'CT Abdomen and Pelvis', 'A CT scan of the organs in the abdomen and pelvis.', 'You may be asked not to eat for about four to six hours and to drink an oral contrast solution at the centre before the scan. Bring kidney function test reports if contrast is planned.', 30, 8),
        ('ct', 'ct-kub', 'CT KUB (Kidney, Ureter, Bladder)', 'A CT scan of the kidneys, ureters and bladder, commonly used to look for stones.', 'Drink water before the scan as advised so that the bladder is moderately full. Usually no contrast is needed.', 15, 9),
        ('ct', 'ct-ivu-urography', 'CT IVU / Urography', 'A contrast CT scan that shows the kidneys and urinary tract in detail.', 'You may be asked not to eat for about four hours. Bring kidney function test reports. Tell staff about any allergy, diabetes medicines or kidney disease.', 40, 10),
        ('ct', 'ct-spine', 'CT Spine (Cervical, Thoracic, Lumbar)', 'A CT scan of the bones of the neck, upper back or lower back.', 'No special preparation is usually needed. Remove metal items from the area being scanned.', 15, 11),
        ('ct', 'ct-extremities', 'CT Extremities (Bones and Joints)', 'A CT scan of the bones and joints of the arms or legs.', 'No special preparation is usually needed. Wear loose clothing and remove metal items from the area being scanned.', 15, 12),
        ('ct', 'ct-hrct-lungs', 'CT HRCT (Lungs)', 'A high-resolution CT scan that shows fine detail of the lung tissue.', 'No special preparation is usually needed. You will be asked to hold your breath for a few seconds during the scan.', 15, 13),
        ('ct', 'ct-enterography-colonography', 'CT Enterography / Colonography', 'A CT scan of the small bowel or large bowel.', 'Special bowel preparation and a clear-liquid diet may be needed; the centre will give you written instructions when you book. Bring kidney function test reports if contrast is planned.', 60, 14),
        ('ct', 'ct-pelvis', 'CT Pelvis', 'A CT scan of the pelvic bones and organs.', 'You may be asked not to eat for about four hours and to come with a moderately full bladder.', 15, 15),
        ('ct', 'ct-guided-procedures', 'CT Guided Procedures (Biopsies, Drainage, Aspiration)', 'Procedures such as biopsy, drainage or aspiration performed with CT guidance.', 'A consultation is needed first. You may be asked not to eat for about six hours, to stop or adjust blood thinners only as your doctor advises, and to bring recent blood test reports. Come with an adult companion.', 60, 16),
        ('biopsy-usg-guided', 'usg-guided-fnac', 'FNAC', 'Fine needle aspiration cytology: a very thin needle takes a sample of cells from a lump under ultrasound guidance.', 'Usually no fasting is needed. Tell staff if you take blood thinners. Bring previous scan reports of the lump.', 30, 1),
        ('biopsy-usg-guided', 'usg-guided-core-needle-biopsy', 'Core Needle Biopsy', 'A slightly larger needle takes small tissue cores under ultrasound guidance for detailed examination.', 'Follow fasting instructions given by the centre. Do not stop blood thinners on your own; discuss them with your doctor in advance. Bring recent blood test reports and come with an adult companion.', 45, 2),
        ('biopsy-usg-guided', 'usg-guided-breast-biopsy', 'Breast', 'A needle biopsy of a breast lump or area of concern guided by ultrasound.', 'Wear a separate top. Tell staff about blood thinners. Bring previous mammography and ultrasound reports.', 45, 3),
        ('biopsy-usg-guided', 'usg-guided-liver-biopsy', 'Liver', 'A needle biopsy of the liver guided by ultrasound.', 'You will usually be asked not to eat for about six hours. Recent blood clotting test reports are needed. Plan to rest after the procedure and come with an adult companion.', 60, 4),
        ('biopsy-usg-guided', 'usg-guided-kidney-biopsy', 'Kidney', 'A needle biopsy of the kidney guided by ultrasound.', 'You will usually be asked not to eat for about six hours. Recent blood clotting and kidney test reports are needed. Plan to rest after the procedure and come with an adult companion.', 60, 5),
        ('biopsy-usg-guided', 'usg-guided-prostate-biopsy-trus', 'Prostate (TRUS guided)', 'A needle biopsy of the prostate guided by transrectal ultrasound.', 'Follow the bowel preparation and any medicines prescribed by your doctor. Tell staff about blood thinners. Come with an adult companion.', 60, 6),
        ('biopsy-usg-guided', 'usg-guided-lymph-node-biopsy', 'Lymph Node', 'A needle biopsy of an enlarged lymph node guided by ultrasound.', 'Usually no fasting is needed for superficial nodes. Tell staff about blood thinners and bring previous scan reports.', 30, 7),
        ('biopsy-usg-guided', 'usg-guided-soft-tissue-biopsy', 'Soft Tissue / Musculoskeletal', 'A needle biopsy of a soft tissue or muscle swelling guided by ultrasound.', 'Wear loose clothing. Tell staff about blood thinners and bring previous scan reports.', 45, 8),
        ('biopsy-usg-guided', 'usg-guided-drainage-aspiration', 'Drainage and Aspiration', 'Removal of a fluid collection through a needle or thin tube guided by ultrasound.', 'Follow fasting instructions given by the centre. Tell staff about blood thinners and bring recent blood test reports.', 45, 9),
        ('biopsy-ct-guided', 'ct-guided-lung-biopsy', 'Lung', 'A needle biopsy of a lung lesion guided by CT.', 'You will usually be asked not to eat for about six hours. Recent blood clotting test reports are needed. Plan to rest and be observed after the procedure and come with an adult companion.', 90, 1),
        ('biopsy-ct-guided', 'ct-guided-liver-biopsy', 'Liver', 'A needle biopsy of a liver lesion guided by CT.', 'You will usually be asked not to eat for about six hours. Recent blood clotting test reports are needed. Come with an adult companion.', 90, 2),
        ('biopsy-ct-guided', 'ct-guided-retroperitoneal-mass-biopsy', 'Retroperitoneal Mass', 'A needle biopsy of a mass deep in the back of the abdomen guided by CT.', 'You will usually be asked not to eat for about six hours. Recent blood clotting test reports are needed. Come with an adult companion.', 90, 3),
        ('biopsy-ct-guided', 'ct-guided-lymph-node-biopsy', 'Lymph Node', 'A needle biopsy of a deep lymph node guided by CT.', 'You will usually be asked not to eat for about six hours. Recent blood clotting test reports are needed. Come with an adult companion.', 90, 4),
        ('biopsy-ct-guided', 'ct-guided-paraspinal-biopsy', 'Paraspinal Tissue', 'A needle biopsy of tissue next to the spine guided by CT.', 'You will usually be asked not to eat for about six hours. Recent blood clotting test reports are needed. Come with an adult companion.', 90, 5),
        ('biopsy-ct-guided', 'ct-guided-deep-seated-lesion-biopsy', 'Other Deep-Seated Lesions', 'A needle biopsy of other deep areas that are best reached with CT guidance.', 'You will usually be asked not to eat for about six hours. Recent blood clotting test reports are needed. Come with an adult companion.', 90, 6),
        ('biopsy-ct-guided', 'ct-guided-drainage-aspiration', 'Drainage and Aspiration', 'Removal of a deep fluid collection through a needle or thin tube guided by CT.', 'You will usually be asked not to eat for about six hours. Recent blood test reports are needed. Come with an adult companion.', 60, 7)
) AS item (category_slug, slug, name, short_description, preparation_tips, duration_minutes, sort_order)
JOIN scan_categories category ON category.slug = item.category_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO checklist_items (scan_type_id, modality, code, question, help_text, answer_type, is_required, attention_answers, sort_order)
VALUES
    (NULL, 'USG', 'usg_previous_reports', 'Will you bring previous scan or medical reports related to this scan?', 'Previous reports help the radiologist compare findings.', 'yes_no', FALSE, ARRAY[]::TEXT[], 1),
    (NULL, 'CT', 'ct_contrast_allergy', 'Have you ever had an allergic reaction to contrast dye, iodine or any medicine?', 'Contrast is sometimes used to make images clearer. Staff will review this before your scan.', 'yes_no_unsure', TRUE, ARRAY['yes', 'unsure'], 1),
    (NULL, 'CT', 'ct_pregnancy', 'Is there any chance that you are pregnant?', 'CT uses X-rays. Please tell staff if you might be pregnant. Answer no if this does not apply to you.', 'yes_no_unsure', TRUE, ARRAY['yes', 'unsure'], 2),
    (NULL, 'CT', 'ct_kidney_disease', 'Do you have kidney disease or diabetes?', 'This helps staff decide whether a kidney function test is needed before contrast.', 'yes_no_unsure', TRUE, ARRAY['yes', 'unsure'], 3),
    (NULL, 'CT', 'ct_metformin', 'Do you take metformin or another diabetes medicine?', 'Do not stop any medicine on your own. Staff will advise you if contrast is planned.', 'yes_no_unsure', TRUE, ARRAY['yes', 'unsure'], 4),
    (NULL, 'CT', 'ct_kidney_test_report', 'Do you have a recent kidney function (creatinine) test report?', 'Bring it with you if you have one.', 'yes_no', FALSE, ARRAY[]::TEXT[], 5),
    (NULL, 'BIOPSY', 'biopsy_blood_thinners', 'Do you take blood thinners such as aspirin, clopidogrel, warfarin or similar medicines?', 'Do not stop any medicine on your own. Your doctor will advise whether and when to pause it.', 'yes_no_unsure', TRUE, ARRAY['yes', 'unsure'], 1),
    (NULL, 'BIOPSY', 'biopsy_bleeding_disorder', 'Do you have a bleeding or clotting disorder?', NULL, 'yes_no_unsure', TRUE, ARRAY['yes', 'unsure'], 2),
    (NULL, 'BIOPSY', 'biopsy_anaesthetic_allergy', 'Are you allergic to local anaesthetic or any medicine?', NULL, 'yes_no_unsure', TRUE, ARRAY['yes', 'unsure'], 3),
    (NULL, 'BIOPSY', 'biopsy_pregnancy', 'Is there any chance that you are pregnant?', 'Answer no if this does not apply to you.', 'yes_no_unsure', TRUE, ARRAY['yes', 'unsure'], 4),
    (NULL, 'BIOPSY', 'biopsy_blood_tests', 'Do you have recent blood test reports, including clotting tests, if your doctor asked for them?', 'Bring the reports with you.', 'yes_no', TRUE, ARRAY['no'], 5),
    (NULL, 'BIOPSY', 'biopsy_companion', 'Will an adult companion come with you?', 'It is safer to have someone accompany you home after the procedure.', 'yes_no', TRUE, ARRAY['no'], 6),
    (NULL, 'BIOPSY', 'biopsy_consent_understood', 'Do you understand that the procedure, its benefits and risks will be explained and written consent taken before it starts?', NULL, 'yes_no', TRUE, ARRAY['no'], 7)
ON CONFLICT (code) DO NOTHING;

INSERT INTO checklist_items (scan_type_id, modality, code, question, help_text, answer_type, is_required, attention_answers, sort_order)
SELECT scan.id, NULL, item.code, item.question, item.help_text, item.answer_type, item.is_required, item.attention_answers, item.sort_order
FROM (
    VALUES
        ('whole-abdomen', 'whole_abdomen_fasting', 'Will you be able to avoid food for about six hours before the scan?', 'Plain water is usually allowed.', 'yes_no', TRUE, ARRAY['no'], 10),
        ('whole-abdomen', 'whole_abdomen_full_bladder', 'Will you come with a comfortably full bladder?', 'Drink water before the scan and avoid passing urine until it is done.', 'yes_no', TRUE, ARRAY['no'], 11),
        ('liver-gallbladder-biliary', 'liver_gb_fasting', 'Will you be able to avoid food for about six hours before the scan?', 'Plain water is usually allowed.', 'yes_no', TRUE, ARRAY['no'], 10),
        ('pancreas-spleen', 'pancreas_spleen_fasting', 'Will you be able to avoid food for about six hours before the scan?', 'Plain water is usually allowed.', 'yes_no', TRUE, ARRAY['no'], 10),
        ('renal-urinary-tract', 'renal_full_bladder', 'Will you come with a comfortably full bladder?', NULL, 'yes_no', TRUE, ARRAY['no'], 10),
        ('pelvic-usg-transabdominal', 'pelvic_full_bladder', 'Will you come with a full bladder?', 'Drink four to five glasses of water about one hour before the scan.', 'yes_no', TRUE, ARRAY['no'], 10),
        ('pelvic-usg-transabdominal', 'pelvic_lmp_date', 'First day of your last menstrual period, if applicable', 'Leave blank if not applicable.', 'date', FALSE, ARRAY[]::TEXT[], 11),
        ('transvaginal-usg-tvs', 'tvs_consent', 'Do you agree to an internal (transvaginal) scan after it is explained to you?', 'You can change your mind at any time.', 'yes_no', TRUE, ARRAY['no'], 10),
        ('transvaginal-usg-tvs', 'tvs_lmp_date', 'First day of your last menstrual period, if applicable', 'Leave blank if not applicable.', 'date', FALSE, ARRAY[]::TEXT[], 11),
        ('follicular-monitoring', 'follicular_cycle_day', 'First day of your current menstrual cycle', NULL, 'date', TRUE, ARRAY[]::TEXT[], 10),
        ('pcos-evaluation', 'pcos_lmp_date', 'First day of your last menstrual period', NULL, 'date', FALSE, ARRAY[]::TEXT[], 10),
        ('early-pregnancy-scan', 'early_pregnancy_lmp_date', 'First day of your last menstrual period', NULL, 'date', FALSE, ARRAY[]::TEXT[], 10),
        ('dating-scan', 'dating_lmp_date', 'First day of your last menstrual period', NULL, 'date', FALSE, ARRAY[]::TEXT[], 10),
        ('dating-scan', 'dating_full_bladder', 'Will you come with a comfortably full bladder?', NULL, 'yes_no', TRUE, ARRAY['no'], 11),
        ('nt-scan', 'nt_referral', 'Has your obstetrician advised this scan and its timing?', NULL, 'yes_no', TRUE, ARRAY['no'], 10),
        ('anomaly-scan', 'anomaly_referral', 'Has your obstetrician advised this scan and its timing?', NULL, 'yes_no', TRUE, ARRAY['no'], 10),
        ('trus', 'trus_blood_thinners', 'Do you take blood thinners such as aspirin, clopidogrel, warfarin or similar medicines?', 'Do not stop any medicine on your own.', 'yes_no_unsure', TRUE, ARRAY['yes', 'unsure'], 10),
        ('trus', 'trus_consent', 'Do you agree to a transrectal scan after it is explained to you?', 'You can change your mind at any time.', 'yes_no', TRUE, ARRAY['no'], 11),
        ('ct-kub', 'ct_kub_bladder', 'Will you drink water before the scan as advised?', NULL, 'yes_no', TRUE, ARRAY['no'], 10),
        ('ct-abdomen-pelvis', 'ct_abdomen_fasting', 'Will you be able to avoid food for about four to six hours before the scan?', 'The centre will confirm the exact instructions.', 'yes_no', TRUE, ARRAY['no'], 10),
        ('ct-enterography-colonography', 'ct_bowel_prep', 'Have you received and understood the bowel preparation instructions?', 'Contact the centre if you have not received them.', 'yes_no', TRUE, ARRAY['no'], 10),
        ('ct-guided-procedures', 'ct_procedure_consultation', 'Have you had a consultation with the doctor about this procedure?', NULL, 'yes_no', TRUE, ARRAY['no'], 10),
        ('ct-guided-procedures', 'ct_procedure_blood_thinners', 'Do you take blood thinners such as aspirin, clopidogrel, warfarin or similar medicines?', 'Do not stop any medicine on your own.', 'yes_no_unsure', TRUE, ARRAY['yes', 'unsure'], 11)
) AS item (scan_slug, code, question, help_text, answer_type, is_required, attention_answers, sort_order)
JOIN scan_types scan ON scan.slug = item.scan_slug
ON CONFLICT (code) DO NOTHING;

INSERT INTO faqs (question, answer, category, sort_order)
VALUES
    ('How do I book an appointment?', 'Use the Book Appointment page to choose a branch, scan, date and an available time. You can also call or visit the centre. You will receive a confirmation after booking.', 'booking', 1),
    ('Can I reschedule or cancel my appointment?', 'Yes. Log in to the patient portal to reschedule or cancel an upcoming appointment, or contact the centre.', 'booking', 2),
    ('Do I need a doctor''s referral?', 'Please bring your doctor''s referral or prescription if you have one, as it helps the radiologist focus on your concern. Contact the centre if you are unsure.', 'booking', 3),
    ('How should I prepare for my scan?', 'Preparation depends on the scan. Each service on the Services page lists preparation tips, and you will answer a short safety checklist while booking. Follow any instructions given by the centre or your doctor.', 'preparation', 4),
    ('What should I bring with me?', 'Bring your doctor''s referral, any previous scan or medical reports, a list of your current medicines and a photo identity document.', 'preparation', 5),
    ('Is ultrasound safe?', 'Ultrasound uses sound waves and does not use X-ray radiation. It is widely used in pregnancy and for children.', 'general', 6),
    ('Does a CT scan use radiation?', 'Yes, CT uses X-rays. A CT scan is done only when it is useful for your care. Tell staff if you are or might be pregnant.', 'general', 7),
    ('Will the centre tell me the sex of my baby?', 'No. Prenatal sex determination is prohibited under the PCPNDT Act and is not done at this centre.', 'general', 8),
    ('How will I receive my report?', 'When your report is ready you can download it securely from the patient portal. Your referring doctor can also access it if they referred you through the portal.', 'reports', 9),
    ('How is my personal and medical information protected?', 'Reports are encrypted before they are stored and can be downloaded only by you, your linked referring doctor and authorised staff. Every download is logged. See the Privacy page for details.', 'privacy', 10),
    ('Is this website for emergencies?', 'No. This website does not give medical advice and is not for emergencies. In an emergency, call 112 or go to the nearest hospital.', 'general', 11)
ON CONFLICT (question) DO NOTHING;

INSERT INTO site_settings (key, value, value_type, group_name, label, is_public, is_placeholder)
VALUES
    ('clinic.name', 'Meghnad Diagnostic Centre', 'string', 'clinic', 'Clinic name', TRUE, FALSE),
    ('clinic.short_name', 'MDC', 'string', 'clinic', 'Short name', TRUE, FALSE),
    ('clinic.logo_tagline', 'Well Experienced Intimate Care', 'string', 'clinic', 'Logo tagline', TRUE, FALSE),
    ('clinic.taglines', '["Imaging for a Healthier Tomorrow","Complete Diagnostic Care Under One Roof","Accurate | Reliable | Compassionate Care","Your Health is Our Priority","Trusted Diagnostics for a Brighter, Healthier You"]', 'json', 'clinic', 'Brand taglines', TRUE, FALSE),
    ('clinic.trust_pillars', '["Accurate Reports","Experienced Radiologists","Modern Technology","Patient Centric Care","Timely Results"]', 'json', 'clinic', 'Trust pillars', TRUE, FALSE),
    ('clinic.logo_url', NULL, 'image', 'clinic', 'Logo image', TRUE, TRUE),
    ('contact.phone', NULL, 'phone', 'contact', 'Main phone number', TRUE, TRUE),
    ('contact.whatsapp', NULL, 'phone', 'contact', 'WhatsApp number', TRUE, TRUE),
    ('contact.email', NULL, 'email', 'contact', 'Contact email', TRUE, TRUE),
    ('contact.opening_hours', NULL, 'text', 'contact', 'Opening hours', TRUE, TRUE),
    ('links.google_reviews_url', NULL, 'url', 'links', 'Google reviews page', TRUE, TRUE),
    ('links.google_maps_url', NULL, 'url', 'links', 'Google Maps place link', TRUE, TRUE),
    ('doctor.name', 'Dr. Meghnad Padsalgikar', 'string', 'doctor', 'Doctor name', TRUE, FALSE),
    ('doctor.qualifications', 'MBBS, DMRE, DNB (Radiology)', 'string', 'doctor', 'Qualifications', TRUE, FALSE),
    ('doctor.title', 'Radiologist', 'string', 'doctor', 'Title', TRUE, FALSE),
    ('doctor.affiliation', 'Sabale Hospital, Bhosari', 'string', 'doctor', 'Hospital affiliation', TRUE, FALSE),
    ('doctor.bio', NULL, 'text', 'doctor', 'Biography paragraph', TRUE, TRUE),
    ('doctor.photo_url', NULL, 'image', 'doctor', 'Doctor photo', TRUE, TRUE),
    ('fees.note', NULL, 'text', 'fees', 'Fees information', TRUE, TRUE),
    ('legal.pcpndt_notice', 'Prenatal sex determination is prohibited under the PCPNDT Act.', 'string', 'legal', 'PCPNDT notice', TRUE, FALSE),
    ('legal.medical_disclaimer', 'This website does not give medical advice and is not for emergencies. In an emergency, call 112 or go to the nearest hospital.', 'text', 'legal', 'Medical disclaimer', TRUE, FALSE),
    ('legal.consent_version', '2026-10-v1', 'string', 'legal', 'Current consent text version', TRUE, FALSE),
    ('alerts.escalation_minutes', '30', 'string', 'alerts', 'Critical alert escalation window in minutes', FALSE, FALSE)
ON CONFLICT (key) DO NOTHING;
