# HomeBot

HomeBot is a Quarkus-based chatbot application that integrates with LangChain4j and OpenAI to provide a conversational interface for accessing weather information from Netatmo devices.

## Project Overview

HomeBot combines the power of Quarkus, "the Supersonic Subatomic Java Framework," with modern AI capabilities through LangChain4j to create an interactive chatbot experience. The application features:

- Real-time chat interface using WebSockets
- Integration with OpenAI through LangChain4j
- Weather information retrieval from Netatmo devices
- Modern web component-based UI
- Multiple deployment options (JVM, Native, Container)

## Prerequisites

- JDK 21 or later
- Maven 3.8.1+
- Docker (for containerization)
- GraalVM (for native builds, optional)

## Running the Application in Dev Mode

Quarkus includes a development mode that enables live coding. To start the application in dev mode:

```shell script
./mvnw quarkus:dev
```

This will start the application on port 8080. You can access:
- The application UI at: http://localhost:8080/
- The Dev UI at: http://localhost:8080/q/dev/ (available in dev mode only)

### Development Features

In dev mode, you can:
- Make changes to your code and see them reflected immediately
- Debug the application with hot reloading
- Access the Dev UI for various development tools

## Packaging and Running the Application

### JVM Mode

To package the application for JVM mode:

```shell script
./mvnw package
```

This produces the `quarkus-run.jar` file in the `target/quarkus-app/` directory. The application can be run using:

```shell script
java -jar target/quarkus-app/quarkus-run.jar
```

For an über-jar (single JAR with all dependencies):

```shell script
./mvnw package -Dquarkus.package.jar.type=uber-jar
```

Then run with:

```shell script
java -jar target/*-runner.jar
```

## Containerization

### JVM Mode Container

To build a container image for JVM mode:

1. First package the application:
   ```shell script
   ./mvnw package
   ```

2. Build the Docker image:
   ```shell script
   docker build -f src/main/docker/Dockerfile.jvm -t quarkus/homebot-jvm .
   ```

3. Run the container:
   ```shell script
   docker run -i --rm -p 8080:8080 quarkus/homebot-jvm
   ```

### Native Mode Container

For a smaller, faster container using native compilation:

1. Build the native executable:
   ```shell script
   ./mvnw package -Dnative -Dquarkus.native.container-build=true
   ```

2. Build the Docker image:
   ```shell script
   docker build -f src/main/docker/Dockerfile.native -t quarkus/homebot .
   ```

3. Run the container:
   ```shell script
   docker run -i --rm -p 8080:8080 quarkus/homebot
   ```

## Native Compilation

### Local Native Build

If you have GraalVM installed, you can create a native executable directly:

```shell script
./mvnw package -Dnative
```

Then run the executable:

```shell script
./target/homebot-1.0.0-SNAPSHOT-runner
```

### Container-based Native Build

If you don't have GraalVM installed, you can use container-based builds:

```shell script
./mvnw package -Dnative -Dquarkus.native.container-build=true
```

## Configuration

The application is configured through `application.properties`. Key configurations include:

- OpenAI API key
- Netatmo integration settings
- Timeout settings
- HTTP port configuration

## Related Guides

- [LangChain4j OpenAI Guide](https://docs.quarkiverse.io/quarkus-langchain4j/dev/index.html)
- [Quarkus LangChain4j OpenShift AI Guide](https://docs.quarkiverse.io/quarkus-langchain4j/dev/index.html)
- [Quarkus WebSockets Guide](https://quarkus.io/guides/websockets)
- [Quarkus Container Images Guide](https://quarkus.io/guides/container-image)
