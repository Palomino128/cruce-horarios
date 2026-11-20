package utp.edu.pe.cruce_horarios.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Sistema de Verificación de Cruce de Horarios Académicos para Docentes")
                        .version("1.0.0")
                        .description("Documentación oficial de los endpoints de la API REST para el control y validación de cruces de horarios en reprogramaciones académicas - UTP Sede Arequipa.")
                        .contact(new Contact()
                                .name("Carrera de Ingeniería de Sistemas e Informática")
                                .email("soporte_academico@utp.edu.pe")));
    }
}
