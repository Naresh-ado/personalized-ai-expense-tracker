INSERT INTO users (email, name, google_id) VALUES
('demo@example.com', 'Demo User', 'demo-google');

INSERT INTO merchant_categories (user_id, merchant_name, category) VALUES
(1, 'SWIGGY', 'Food'),
(1, 'UBER', 'Transport'),
(1, 'AMAZON', 'Shopping');

INSERT INTO transactions (user_id, amount, merchant, type, category, date, raw_sms) VALUES
(1, 550.00, 'SWIGGY', 'debit', 'Food', '2026-07-01', 'Rs.550 debited from A/C XXXX1234 to SWIGGY via UPI'),
(1, 1200.00, 'AMAZON', 'debit', 'Shopping', '2026-07-03', 'Rs.1200 debited from A/C XXXX1234 to AMAZON via UPI'),
(1, 25000.00, 'SALARY', 'credit', 'Income', '2026-07-05', 'Rs.25000 credited to account');

INSERT INTO budgets (user_id, category, monthly_limit, month) VALUES
(1, 'Food', 5000.00, '2026-07'),
(1, 'Shopping', 3000.00, '2026-07');
