package com.example.framepost;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class FramepostApplication {

    public static void main(String[] args) {
        SpringApplication.run(FramepostApplication.class, args);
    }
}
