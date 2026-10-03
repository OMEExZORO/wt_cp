SET NAMES utf8mb4;
USE diagnocare;

INSERT INTO users (id, full_name, email, phone, password_hash, role, registration_no, date_of_birth, gender, is_active) VALUES
(1, 'Dr. Meghnad Padsalgikar', 'doctor@diagnocare.test', '9800000001', '$2y$12$JLx2IKdkqNuzFIRSGVoUfeXWmWZ1Vh6hqCx13kGOAclC41RqgAouu', 'doctor', 'MMC-000000', NULL, 'male', 1),
(2, 'Priya Kulkarni', 'reception@diagnocare.test', '9800000002', '$2y$12$f2ZhQTMy5trD5oRRbiabpe4KQrxDnDxOXf1fwzvGZueJd9o8Kcoye', 'receptionist', NULL, NULL, 'female', 1),
(3, 'Rahul Patil', 'patient@diagnocare.test', '9800000003', '$2y$12$46DhiwtTaxMp8SBo4M9ixee7gm6115L6GE7ck5zIRx.2mGGrrXP6e', 'patient', NULL, '1990-05-14', 'male', 1),
(4, 'Dr. Anjali Deshmukh', 'referrer@diagnocare.test', '9800000004', '$2y$12$h5cl.da.ZByDp0GpW6BohuqGymhSuq0QPG.7tCe51DIOFI/1Qt9s2', 'referring_doctor', 'MMC-111111', NULL, 'female', 1);

INSERT INTO branches (id, name, address_line, city, pincode, phone, email, timings, map_query, image_file) VALUES
(1, 'DiagnoCare Bhosari Gaon', 'Shop No. 1, Placeholder Complex, Near Bhosari Gaon Bus Stop, Bhosari', 'Pune', '411039', '9800000101', 'gaon@diagnocare.test', 'Mon-Sat: 9:00 AM - 1:00 PM, 5:00 PM - 8:00 PM | Sunday: Closed', 'Bhosari Gaon, Bhosari, Pune, Maharashtra 411039', 'branch-bhosari-gaon-exterior.jpg'),
(2, 'DiagnoCare Bhosari MIDC', 'Office No. 2, Placeholder Plaza, Telco Road, MIDC Bhosari', 'Pune', '411026', '9800000102', 'midc@diagnocare.test', 'Mon-Sat: 9:00 AM - 1:00 PM, 5:00 PM - 8:00 PM | Sunday: 9:00 AM - 12:00 PM', 'MIDC Bhosari, Pune, Maharashtra 411026', 'branch-bhosari-midc-exterior.jpg');

INSERT INTO scan_types (id, name, category, description, preparation, duration_minutes, price) VALUES
(1, 'Digital X-ray - Chest (PA view)', 'xray', 'High-resolution digital radiograph of the chest for lungs, heart size and ribs.', 'Remove metal jewellery and accessories from the chest area. Inform staff if you may be pregnant.', 10, 400.00),
(2, 'Digital X-ray - Spine / Joints', 'xray', 'Digital radiographs of the spine, knees, shoulders, hands or other joints.', 'Wear loose clothing without metal buttons or zips. Inform staff if you may be pregnant.', 15, 500.00),
(3, 'Sonography - Whole Abdomen', 'sonography', 'Ultrasound of liver, gallbladder, pancreas, spleen, kidneys and urinary bladder.', 'Fast for 6 hours. Drink 4-5 glasses of water 1 hour before the scan and do not empty your bladder.', 20, 1200.00),
(4, 'Sonography - Obstetric (Pregnancy)', 'sonography', 'Pregnancy ultrasound to assess foetal growth, position and well-being.', 'Bring previous scan reports and the referral slip. A full bladder may be required in early pregnancy.', 20, 1300.00),
(5, 'Sonography - Pelvis', 'sonography', 'Ultrasound of the uterus and ovaries or the prostate and bladder.', 'Drink 4-5 glasses of water 1 hour before the scan and do not empty your bladder.', 20, 1100.00),
(6, 'Colour Doppler - Lower Limb Venous', 'colour_doppler', 'Doppler study of leg veins to evaluate DVT and varicose veins.', 'No special preparation. Wear loose clothing.', 30, 2500.00),
(7, 'Colour Doppler - Carotid', 'colour_doppler', 'Doppler study of neck arteries to assess plaque and blood flow to the brain.', 'No special preparation. Avoid high-collared clothing.', 30, 2500.00),
(8, 'Colour Doppler - Obstetric', 'colour_doppler', 'Doppler assessment of blood flow to the foetus and placenta.', 'Bring previous scan reports and the referral slip.', 30, 2200.00);

INSERT INTO slots (branch_id, day_of_week, start_time, end_time)
WITH RECURSIVE times (t) AS (
    SELECT CAST('09:00:00' AS TIME)
    UNION ALL
    SELECT ADDTIME(t, '00:20:00') FROM times WHERE t < CAST('19:40:00' AS TIME)
),
days (d) AS (
    SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
)
SELECT b.id, days.d, times.t, ADDTIME(times.t, '00:20:00')
FROM branches b CROSS JOIN days CROSS JOIN times
WHERE times.t < CAST('12:40:01' AS TIME) OR times.t >= CAST('17:00:00' AS TIME);

INSERT INTO slots (branch_id, day_of_week, start_time, end_time) VALUES
(2, 0, '09:00:00', '09:20:00'), (2, 0, '09:20:00', '09:40:00'), (2, 0, '09:40:00', '10:00:00'),
(2, 0, '10:00:00', '10:20:00'), (2, 0, '10:20:00', '10:40:00'), (2, 0, '10:40:00', '11:00:00'),
(2, 0, '11:00:00', '11:20:00'), (2, 0, '11:20:00', '11:40:00'), (2, 0, '11:40:00', '12:00:00');

INSERT INTO safety_checklist_items (scan_type_id, question, is_required, blocks_scan_if_yes, sort_order) VALUES
(1, 'Is there any chance the patient is pregnant?', 1, 1, 1),
(1, 'Has all metal jewellery been removed from the chest area?', 1, 0, 2),
(2, 'Is there any chance the patient is pregnant?', 1, 1, 1),
(2, 'Does the patient have any metal implants in the region being scanned?', 1, 0, 2),
(3, 'Has the patient fasted for at least 6 hours?', 1, 0, 1),
(3, 'Is the urinary bladder adequately full?', 1, 0, 2),
(4, 'Has the referral slip (Form F under PCPNDT Act) been completed and signed?', 1, 1, 1),
(4, 'Has the patient brought previous obstetric scan reports?', 0, 0, 2),
(5, 'Is the urinary bladder adequately full?', 1, 0, 1),
(6, 'Does the patient have an open wound or dressing on the limb?', 1, 0, 1),
(7, 'Has the patient had recent neck surgery or a central line?', 1, 0, 1),
(8, 'Has the referral slip (Form F under PCPNDT Act) been completed and signed?', 1, 1, 1);

INSERT INTO appointments (patient_id, branch_id, scan_type_id, slot_id, appointment_date, start_time, referring_doctor_id, notes, created_by)
SELECT 3, s.branch_id, 3, s.id, d.dt, s.start_time, 4, 'Seed appointment for demo purposes.', 3
FROM (
    SELECT CURDATE() + INTERVAL 1 DAY AS dt
    UNION ALL SELECT CURDATE() + INTERVAL 2 DAY
) d
JOIN slots s ON s.branch_id = 1 AND s.day_of_week = DAYOFWEEK(d.dt) - 1 AND s.start_time = '10:00:00'
ORDER BY d.dt
LIMIT 1;

INSERT INTO reading_queue (appointment_id, priority, status)
SELECT id, 'routine', 'waiting' FROM appointments ORDER BY id LIMIT 1;

INSERT INTO critical_alerts (patient_id, raised_by, notify_user_id, finding, severity, status, acknowledge_by)
VALUES (3, 1, 4, 'DEMO ONLY: Sample critical finding to illustrate the alert workflow stub.', 'critical', 'open', NOW() + INTERVAL 1 HOUR);
