CREATE TABLE IF NOT EXISTS foundation_check (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO foundation_check (name)
SELECT 'codebreaker-base'
WHERE NOT EXISTS (
    SELECT 1 FROM foundation_check WHERE name = 'codebreaker-base'
);
