-- Base de datos del Sistema de Verificación de Cruce de Horarios Académicos
-- Motor: H2 Database (en memoria: jdbc:h2:mem:cruce_horarios) / compatible con MySQL y PostgreSQL

CREATE TABLE IF NOT EXISTS docente (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS estudiante (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS horario (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    docente_codigo VARCHAR(20) NOT NULL,
    curso VARCHAR(150) NOT NULL,
    dia VARCHAR(20) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    aula VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS matricula (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    estudiante_codigo VARCHAR(20) NOT NULL,
    curso VARCHAR(150) NOT NULL
);

CREATE TABLE IF NOT EXISTS reprogramacion (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    docente_codigo VARCHAR(20) NOT NULL,
    curso VARCHAR(150) NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    aula VARCHAR(10)
);

-- Datos iniciales precargados por DataSeeder
INSERT INTO docente (codigo, nombres, apellidos) VALUES
('DOC-101', 'Ricardo', 'Paredes Soto'),
('DOC-102', 'Carlos', 'Atencio Torres'),
('DOC-103', 'Sayely', 'Alarcón Cárdenas'),
('DOC-104', 'Mariella', 'Muriel Cruzado'),
('DOC-105', 'Cesar', 'Palomino Berrocal');

INSERT INTO horario (docente_codigo, curso, dia, hora_inicio, hora_fin, aula) VALUES
('DOC-101', 'Desarrollo Web Integrado', 'MONDAY', '08:00:00', '10:00:00', 'A101'),
('DOC-101', 'Arquitectura de Software', 'WEDNESDAY', '10:00:00', '12:00:00', 'B204'),
('DOC-101', 'Taller de Programación Web', 'FRIDAY', '14:00:00', '16:00:00', 'C302'),
('DOC-101', 'Inteligencia Artificial', 'TUESDAY', '08:00:00', '10:00:00', 'D105'),
('DOC-102', 'Base de Datos II', 'MONDAY', '10:00:00', '12:00:00', 'E201'),
('DOC-102', 'Sistemas Operativos', 'MONDAY', '14:00:00', '16:00:00', 'F305');

INSERT INTO estudiante (codigo, nombres, apellidos) VALUES
('U23231304', 'Sayely Rosalyn', 'Alarcón Cárdenas'),
('U23261984', 'Mariella Nancy', 'Muriel Cruzado'),
('U23235344', 'Cesar Edu', 'Palomino Berrocal'),
('U23200101', 'Lucía', 'Fernández Quispe'),
('U23200102', 'Mateo', 'Rojas Mendoza');

INSERT INTO matricula (estudiante_codigo, curso) VALUES
('U23231304', 'Desarrollo Web Integrado'),
('U23231304', 'Sistemas Operativos'),
('U23261984', 'Arquitectura de Software'),
('U23261984', 'Base de Datos II'),
('U23235344', 'Taller de Programación Web'),
('U23235344', 'Calidad de Software'),
('U23200101', 'Inteligencia Artificial'),
('U23200101', 'Desarrollo Web Integrado'),
('U23200102', 'Sistemas Distribuidos'),
('U23200102', 'Gestión de Proyectos TI');
